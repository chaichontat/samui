import { CoordsData } from '$src/lib/data/objects/coords';
import { Sample } from '$src/lib/data/objects/sample';
import { HoverSelect } from '$src/lib/sidebar/searchBox';
import {
  annoFeat,
  hoverSelect,
  mapTiles,
  overlays,
  overlaysFeature,
  sEvent,
  sFeatureData,
  sId,
  sMapId,
  sMapp,
  sOverlay,
  sPixel,
  sSample
} from '$src/lib/store';
import { renderMappHarness } from '$src/lib/testing/mappFixture';
import * as imgIntensity from '$src/lib/ui/background/imgIntensity';
import { Mapp } from '$src/lib/ui/mapp';
import { CanvasSpots, WebGLSpots } from '$src/lib/ui/overlays/points';
import MappPage from '$src/pages/mapp.svelte';
import MapTile from '$src/pages/mapTile.svelte';
import { writeArrayBuffer } from 'geotiff';
import Feature from 'ol/Feature.js';
import MapBrowserEvent from 'ol/MapBrowserEvent.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

vi.mock('$src/lib/ui/background/imgIntensity', { spy: true });

describe('Mapp lifecycle', () => {
  beforeEach(() => {
    mapTiles.set([0]);
    overlays.set({});
    overlaysFeature.set({});
    sEvent.set(undefined);
    sId.set({ source: 'test' });
    sMapId.set(0);
    sMapp.set(undefined);
    sOverlay.set(undefined);
    sSample.set(undefined);
    hoverSelect.set(new HoverSelect());
    annoFeat.update((state) => ({ ...state, annotating: undefined }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('publishes only a mounted active map and releases its owned OpenLayers resources', async () => {
    const screen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const map = get(sMapp);

    expect(map).toBeDefined();
    expect(map?.mounted).toBe(true);
    expect(map?.map?.getTarget()).toBeTruthy();

    const nativeMap = map!.map!;
    const scaleLine = map!.scaleLine!;
    const sourceDisposeSpies = nativeMap
      .getLayers()
      .getArray()
      .flatMap((layer) => (layer.getSource() ? [vi.spyOn(layer.getSource()!, 'dispose')] : []));
    expect(nativeMap.getLayers().getLength()).toBeGreaterThan(0);
    expect(nativeMap.getInteractions().getLength()).toBeGreaterThan(0);

    screen.unmount();

    expect(get(sMapp)).toBeUndefined();
    expect(map!.mounted).toBe(false);
    expect(map!.map).toBeUndefined();
    expect(nativeMap.getTarget()).toBeNull();
    expect(nativeMap.getLayers().getLength()).toBe(0);
    expect(nativeMap.getInteractions().getLength()).toBe(0);
    expect(nativeMap.getOverlays().getLength()).toBe(0);
    expect(scaleLine.getMap()).toBeNull();
    expect(sourceDisposeSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(Object.values(get(overlays)).some((overlay) => overlay.map === map)).toBe(false);
  });

  test('destroying one map preserves the newer active map and sibling-owned overlay state', async () => {
    const firstScreen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const firstMap = get(sMapp)!;
    const firstOwnedOverlay = Object.values(get(overlays)).find(
      (overlay) => overlay.map === firstMap
    )!;
    expect(firstOwnedOverlay).toBeDefined();

    sMapId.set(1);
    expect(get(sMapp)).toBeUndefined();
    const secondScreen = await render(MappPage, { props: { sample: undefined, uid: 1 } });
    const secondMap = get(sMapp)!;
    const siblingOverlay = new WebGLSpots(secondMap);
    overlays.update((current) => ({ ...current, [siblingOverlay.uid]: siblingOverlay }));
    sOverlay.set(siblingOverlay.uid);

    firstScreen.unmount();

    expect(get(sMapp)).toBe(secondMap);
    expect(secondMap.map?.getTarget()).toBeTruthy();
    expect(get(overlays)[firstOwnedOverlay.uid]).toBeUndefined();
    expect(get(overlays)[siblingOverlay.uid]).toBe(siblingOverlay);
    expect(get(sOverlay)).toBe(siblingOverlay.uid);

    secondScreen.unmount();

    expect(get(sMapp)).toBeUndefined();
    expect(secondMap.map).toBeUndefined();
    expect(get(overlays)[siblingOverlay.uid]).toBeUndefined();
  });

  test('a cross-owned selected overlay cannot be updated by or publish through the active sibling map', async () => {
    const firstScreen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const firstMap = get(sMapp)!;
    const firstOverlay = get(overlays)[get(sOverlay)!];
    const feature = { group: 'genes', feature: 'cross-owned' };
    const coords = new CoordsData({
      name: 'cross-owned-coords',
      shape: 'circle',
      mPerPx: 1,
      size: 10,
      pos: [{ x: 1, y: 2, id: 'spot' }]
    });
    const featureResult = {
      data: [4],
      dataType: 'quantitative' as const,
      coords,
      minmax: [4, 4] as [number, number],
      name: feature
    };
    const sample = new Sample({ name: 'cross-owned-sample' });
    vi.spyOn(sample, 'getFeature').mockResolvedValue(featureResult);

    sMapId.set(1);
    const secondScreen = await render(MappPage, { props: { sample, uid: 1 } });
    const secondMap = get(sMapp)!;
    await expect.poll(() => get(sEvent)?.type).toBe('sampleUpdated');
    expect(secondMap).not.toBe(firstMap);

    const updateSpy = vi.spyOn(firstOverlay, 'update').mockResolvedValue(false);
    sOverlay.set(firstOverlay.uid);
    overlaysFeature.set({ [firstOverlay.uid]: feature });
    await tick();
    await Promise.resolve();

    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();

    const sentinelFeature = { group: 'genes', feature: 'sentinel' };
    const sentinelData = { ...featureResult, name: sentinelFeature };
    sFeatureData.set(sentinelData);
    sEvent.set({ type: 'viewAdjusted' });

    await expect(firstOverlay.update(sample, feature, () => true)).resolves.toEqual(featureResult);
    expect(firstOverlay.currFeature).toEqual(feature);
    expect(get(sFeatureData)).toBe(sentinelData);
    expect(get(sEvent)).toEqual({ type: 'viewAdjusted' });

    firstScreen.unmount();
    secondScreen.unmount();
  });

  test('real pointer handling publishes global state only from the active split map', async () => {
    const firstScreen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const firstMap = get(sMapp)!;
    sMapId.set(1);
    const secondScreen = await render(MappPage, { props: { sample: undefined, uid: 1 } });
    const secondMap = get(sMapp)!;
    const coords = new CoordsData({
      name: 'pointer-ownership',
      shape: 'circle',
      mPerPx: 1,
      size: 100,
      pos: [{ x: 0, y: 0, id: 'hit' }]
    });
    firstMap.persistentLayers.background.mPerPx = 1;
    secondMap.persistentLayers.background.mPerPx = 1;
    firstMap.persistentLayers.active.update(coords, 0);
    secondMap.persistentLayers.active.update(coords, 0);
    vi.spyOn(firstMap.map!, 'forEachFeatureAtPixel').mockImplementation((_pixel, callback) =>
      callback(
        firstMap.persistentLayers.active.feature,
        firstMap.persistentLayers.active.layer!,
        firstMap.persistentLayers.active.feature.getGeometry()!
      )
    );
    vi.spyOn(secondMap.map!, 'forEachFeatureAtPixel').mockImplementation((_pixel, callback) =>
      callback(
        secondMap.persistentLayers.active.feature,
        secondMap.persistentLayers.active.layer!,
        secondMap.persistentLayers.active.feature.getGeometry()!
      )
    );
    const inactiveEvent = new MapBrowserEvent(
      'pointermove',
      firstMap.map!,
      new PointerEvent('pointermove', { pointerType: 'mouse' })
    );
    inactiveEvent.coordinate = [8, -6];
    inactiveEvent.pixel = [0, 0];
    const activeEvent = new MapBrowserEvent(
      'pointermove',
      secondMap.map!,
      new PointerEvent('pointermove', { pointerType: 'mouse' })
    );
    activeEvent.coordinate = [4, -3];
    activeEvent.pixel = [0, 0];
    const sentinelFeature = { group: 'genes', feature: 'sentinel' };
    const inactiveFeature = { group: 'genes', feature: 'inactive' };
    const activeFeature = { group: 'genes', feature: 'active' };
    firstMap.attachPointerListener(
      {
        pointermove() {
          hoverSelect.set(new HoverSelect({ selected: inactiveFeature }));
          sEvent.set({ type: 'featureUpdated' });
        }
      },
      { layer: firstMap.persistentLayers.active.layer }
    );
    secondMap.attachPointerListener(
      {
        pointermove() {
          hoverSelect.set(new HoverSelect({ selected: activeFeature }));
        }
      },
      { layer: secondMap.persistentLayers.active.layer }
    );
    sId.set({ source: 'sentinel', idx: 21 });
    sPixel.set([99, 101]);
    sEvent.set({ type: 'viewAdjusted' });
    hoverSelect.set(new HoverSelect({ selected: sentinelFeature }));

    firstMap.runPointerListener(inactiveEvent);

    expect(get(sId)).toEqual({ source: 'sentinel', idx: 21 });
    expect(get(sPixel)).toEqual([99, 101]);
    expect(get(sEvent)).toEqual({ type: 'viewAdjusted' });
    expect(get(hoverSelect).selected).toEqual(sentinelFeature);

    secondMap.runPointerListener(activeEvent);

    expect(get(sPixel)).toEqual([4, 3]);
    expect(get(hoverSelect).selected).toEqual(activeFeature);
    firstScreen.unmount();
    secondScreen.unmount();
  });

  test('ignores delayed sample hydration after the map is destroyed', async () => {
    let beginHydration!: () => void;
    const hydrationStarted = new Promise<void>((resolve) => {
      beginHydration = resolve;
    });
    let finishHydration!: () => void;
    const hydrationGate = new Promise<void>((resolve) => {
      finishHydration = resolve;
    });
    const sample = new Sample({ name: 'delayed-sample' });
    vi.spyOn(sample, 'hydrate').mockImplementation(async () => {
      beginHydration();
      await hydrationGate;
      return sample;
    });

    const originalUpdateSample = Mapp.prototype.updateSample;
    let finishUpdate!: (updated: boolean) => void;
    const updateFinished = new Promise<boolean>((resolve) => {
      finishUpdate = resolve;
    });
    vi.spyOn(Mapp.prototype, 'updateSample').mockImplementation(async function (
      this: Mapp,
      nextSample: Sample
    ) {
      const updated = await originalUpdateSample.call(this, nextSample);
      finishUpdate(updated);
      return updated;
    });

    const screen = await render(MappPage, { props: { sample, uid: 0 } });
    const map = get(sMapp)!;
    const nativeMap = map.map!;
    await hydrationStarted;
    sEvent.set({ type: 'viewAdjusted' });
    sId.set({ source: 'sentinel', idx: 7 });

    screen.unmount();
    finishHydration();

    await expect(updateFinished).resolves.toBe(false);
    expect(get(sEvent)).toEqual({ type: 'viewAdjusted' });
    expect(get(sId)).toEqual({ source: 'sentinel', idx: 7 });
    expect(nativeMap.getTarget()).toBeNull();
    expect(nativeMap.getLayers().getLength()).toBe(0);
  });

  test('a superseded sample update cannot mutate its overlay or emit a stale feature event', async () => {
    const screen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const map = get(sMapp)!;
    const overlay = get(overlays)[get(sOverlay)!];
    const feature = { group: 'genes', feature: 'marker' };
    overlay.currFeature = feature;
    const coords = new CoordsData({
      name: 'race-coords',
      shape: 'circle',
      mPerPx: 1,
      size: 10,
      pos: [{ x: 1, y: 2, id: 'spot' }]
    });
    const firstSample = new Sample({ name: 'first' });
    const secondSample = new Sample({ name: 'second' });
    type FeatureResult = NonNullable<Awaited<ReturnType<Sample['getFeature']>>>;
    const firstResult: FeatureResult = {
      data: [1],
      dataType: 'quantitative',
      coords,
      minmax: [1, 1],
      name: feature,
      unit: 'first-unit'
    };
    const secondResult: FeatureResult = {
      data: [2],
      dataType: 'quantitative',
      coords,
      minmax: [2, 2],
      name: feature,
      unit: 'second-unit'
    };
    let beginFirstFeature!: () => void;
    const firstFeatureStarted = new Promise<void>((resolve) => {
      beginFirstFeature = resolve;
    });
    let finishFirstFeature!: () => void;
    const firstFeatureGate = new Promise<void>((resolve) => {
      finishFirstFeature = resolve;
    });
    vi.spyOn(firstSample, 'getFeature').mockImplementation(async () => {
      beginFirstFeature();
      await firstFeatureGate;
      return firstResult;
    });
    vi.spyOn(secondSample, 'getFeature').mockResolvedValue(secondResult);

    const firstUpdate = map.updateSample(firstSample);
    await firstFeatureStarted;
    await expect(map.updateSample(secondSample)).resolves.toBe(true);
    expect(overlay.source.getFeatures()[0]?.get('value')).toBe(2);
    expect(overlay.currSample).toBe('second');
    sEvent.set({ type: 'viewAdjusted' });

    finishFirstFeature();

    await expect(firstUpdate).resolves.toBe(false);
    expect(overlay.source.getFeatures()[0]?.get('value')).toBe(2);
    expect(overlay.currSample).toBe('second');
    expect(get(sEvent)).toEqual({ type: 'viewAdjusted' });
    screen.unmount();
  });

  test('a slower feature request cannot overwrite a newer feature on the same sample', async () => {
    const screen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const overlay = get(overlays)[get(sOverlay)!];
    const sample = new Sample({ name: 'feature-race' });
    const firstFeature = { group: 'genes', feature: 'first' };
    const secondFeature = { group: 'genes', feature: 'second' };
    const coords = new CoordsData({
      name: 'feature-race-coords',
      shape: 'circle',
      mPerPx: 1,
      size: 10,
      pos: [{ x: 1, y: 2, id: 'spot' }]
    });
    let beginFirstFeature!: () => void;
    const firstFeatureStarted = new Promise<void>((resolve) => {
      beginFirstFeature = resolve;
    });
    let finishFirstFeature!: () => void;
    const firstFeatureGate = new Promise<void>((resolve) => {
      finishFirstFeature = resolve;
    });
    vi.spyOn(sample, 'getFeature').mockImplementation(async (feature) => {
      if (feature.feature === firstFeature.feature) {
        beginFirstFeature();
        await firstFeatureGate;
        return {
          data: [1],
          dataType: 'quantitative',
          coords,
          minmax: [1, 1],
          name: firstFeature
        };
      }
      return {
        data: [2],
        dataType: 'quantitative',
        coords,
        minmax: [2, 2],
        name: secondFeature
      };
    });

    const firstUpdate = overlay.update(sample, firstFeature, () => true);
    await firstFeatureStarted;
    await expect(overlay.update(sample, secondFeature, () => true)).resolves.toBeTruthy();

    finishFirstFeature();

    await expect(firstUpdate).resolves.toBe(false);
    expect(overlay.currFeature).toEqual(secondFeature);
    expect(overlay.source.getFeatures()[0]?.get('value')).toBe(2);
    expect(get(sFeatureData)?.name).toEqual(secondFeature);
    screen.unmount();
  });

  test('deleting an overlay invalidates its pending feature request', async () => {
    const screen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const map = get(sMapp)!;
    const overlay = get(overlays)[get(sOverlay)!];
    const sample = new Sample({ name: 'deleted-overlay' });
    const feature = { group: 'genes', feature: 'delayed' };
    const coords = new CoordsData({
      name: 'deleted-overlay-coords',
      shape: 'circle',
      mPerPx: 1,
      size: 10,
      pos: [{ x: 1, y: 2, id: 'spot' }]
    });
    let beginFeature!: () => void;
    const featureStarted = new Promise<void>((resolve) => {
      beginFeature = resolve;
    });
    let finishFeature!: () => void;
    const featureGate = new Promise<void>((resolve) => {
      finishFeature = resolve;
    });
    vi.spyOn(sample, 'getFeature').mockImplementation(async () => {
      beginFeature();
      await featureGate;
      return {
        data: [1],
        dataType: 'quantitative',
        coords,
        minmax: [1, 1],
        name: feature
      };
    });

    const update = overlay.update(sample, feature, () => true);
    await featureStarted;
    overlay.dispose();
    overlays.update((current) => {
      const { [overlay.uid]: removed, ...remaining } = current;
      expect(removed).toBe(overlay);
      return remaining;
    });
    const layerCountAfterDelete = map.map!.getLayers().getLength();

    finishFeature();

    await expect(update).resolves.toBe(false);
    expect(overlay.layer).toBeUndefined();
    expect(map.map!.getLayers().getLength()).toBe(layerCountAfterDelete);
    screen.unmount();
  });

  test('superseded image-default estimation cannot mutate the image or emit a stale event', async () => {
    const buffer = writeArrayBuffer(
      [
        [
          [0, 255],
          [128, 64]
        ]
      ],
      { width: 2, height: 2 }
    );
    const url = URL.createObjectURL(new Blob([buffer], { type: 'image/tiff' }));
    const imageSample = new Sample({
      name: 'image-first',
      imgParams: {
        urls: [{ url, type: 'network' }],
        channels: ['C1'],
        defaultMinMax: {},
        hasPhysicalScale: false,
        mPerPx: 1,
        maxVal: 255,
        renderMode: 'local-tiff',
        size: { width: 2, height: 2 }
      }
    });
    const nextSample = new Sample({ name: 'image-second' });
    let finishEstimate!: (ranges: Record<string, [number, number]>) => void;
    const estimateFinished = new Promise<Record<string, [number, number]>>((resolve) => {
      finishEstimate = resolve;
    });
    vi.mocked(imgIntensity.estimateCompositeMinMax).mockReturnValue(estimateFinished);

    const screen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const map = get(sMapp)!;
    await expect(map.updateSample(imageSample)).resolves.toBe(true);
    expect(imgIntensity.estimateCompositeMinMax).toHaveBeenCalledOnce();
    await expect(map.updateSample(nextSample)).resolves.toBe(true);
    sEvent.set({ type: 'viewAdjusted' });

    finishEstimate({ C1: [10, 200] });
    await estimateFinished;

    expect(imageSample.image?.defaultMinMax).toEqual({});
    expect(get(sEvent)).toEqual({ type: 'viewAdjusted' });
    screen.unmount();
    URL.revokeObjectURL(url);
  });

  test('superseded annotation selection cannot publish stale hover or overlay state', async () => {
    const screen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const map = get(sMapp)!;
    const overlayId = get(sOverlay)!;
    const selected = { group: 'genes', feature: 'delayed-marker' };
    const coords = new CoordsData({
      name: 'annotation-coords',
      shape: 'circle',
      mPerPx: 1,
      size: 10,
      pos: [{ x: 0, y: 0, id: 'spot' }]
    });
    const firstSample = new Sample({ name: 'annotation-first' });
    firstSample.featureParams = [];
    firstSample.overlayParams = { defaults: [selected] };
    const nextSample = new Sample({ name: 'annotation-second' });
    sSample.set(firstSample);
    annoFeat.update((state) => ({
      ...state,
      annotating: { coordName: coords.name, overlay: overlayId }
    }));
    let beginAnnotation!: () => void;
    const annotationStarted = new Promise<void>((resolve) => {
      beginAnnotation = resolve;
    });
    let finishAnnotation!: () => void;
    const annotationGate = new Promise<void>((resolve) => {
      finishAnnotation = resolve;
    });
    vi.spyOn(firstSample, 'getFeature').mockImplementation(async () => {
      beginAnnotation();
      await annotationGate;
      return {
        data: [1],
        dataType: 'quantitative',
        coords,
        minmax: [1, 1],
        name: selected
      };
    });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    const firstUpdate = map.updateSample(firstSample);
    await annotationStarted;
    await expect(map.updateSample(nextSample)).resolves.toBe(true);
    const sentinel = { group: 'genes', feature: 'current-marker' };
    hoverSelect.set(new HoverSelect({ selected: sentinel }));
    sEvent.set({ type: 'viewAdjusted' });

    finishAnnotation();

    await expect(firstUpdate).resolves.toBe(false);
    expect(get(hoverSelect).selected).toEqual(sentinel);
    expect(get(overlays)[overlayId].currFeature).toBeUndefined();
    expect(get(sEvent)).toEqual({ type: 'viewAdjusted' });
    expect(alertSpy).not.toHaveBeenCalled();
    screen.unmount();
  });

  test('split-tile resize callbacks tolerate teardown of their captured sibling map', async () => {
    mapTiles.set([0, 1]);
    sMapId.set(1);
    const screen = await render(MapTile, {
      props: { hie: { split: 'h', maps: [0, 1] } }
    });
    await expect.poll(() => get(sMapp)?.mounted).toBe(true);
    const closingMap = get(sMapp)!;
    const closeButton = screen.container.querySelector('#view-1 button');
    if (!(closeButton instanceof HTMLButtonElement)) {
      throw new Error('Split-map close button was not rendered.');
    }
    vi.useFakeTimers();

    closeButton.click();
    await tick();

    expect(closingMap.map).toBeUndefined();
    expect(() => vi.advanceTimersByTime(15)).not.toThrow();
    screen.unmount();
  });

  test('an inactive map cannot publish delayed feature defaults or completion events', async () => {
    const firstScreen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const firstMap = get(sMapp)!;
    const overlayId = get(sOverlay)!;
    const selected = { group: 'genes', feature: 'inactive-default' };
    const coords = new CoordsData({
      name: 'inactive-default-coords',
      shape: 'circle',
      mPerPx: 1,
      size: 10,
      pos: [{ x: 0, y: 0, id: 'spot' }]
    });
    const sample = new Sample({ name: 'inactive-sample' });
    sample.featureParams = [];
    sample.overlayParams = { defaults: [selected] };
    sSample.set(sample);
    annoFeat.update((state) => ({
      ...state,
      annotating: { coordName: coords.name, overlay: overlayId }
    }));
    let beginFeature!: () => void;
    const featureStarted = new Promise<void>((resolve) => {
      beginFeature = resolve;
    });
    let finishFeature!: () => void;
    const featureGate = new Promise<void>((resolve) => {
      finishFeature = resolve;
    });
    vi.spyOn(sample, 'getFeature').mockImplementation(async () => {
      beginFeature();
      await featureGate;
      return {
        data: [1],
        dataType: 'quantitative',
        coords,
        minmax: [1, 1],
        name: selected
      };
    });

    const firstUpdate = firstMap.updateSample(sample);
    await featureStarted;
    sMapId.set(1);
    const secondScreen = await render(MappPage, { props: { sample: undefined, uid: 1 } });
    const activeMap = get(sMapp);
    const sentinelFeature = { group: 'genes', feature: 'current' };
    const sentinelData = {
      data: [9],
      dataType: 'quantitative' as const,
      coords,
      minmax: [9, 9] as [number, number],
      name: sentinelFeature
    };
    sId.set({ source: 'sentinel', idx: 11 });
    hoverSelect.set(new HoverSelect({ selected: sentinelFeature }));
    sFeatureData.set(sentinelData);
    sEvent.set({ type: 'viewAdjusted' });

    finishFeature();

    await expect(firstUpdate).resolves.toBe(false);
    expect(get(sMapp)).toBe(activeMap);
    expect(get(sId)).toEqual({ source: 'sentinel', idx: 11 });
    expect(get(hoverSelect).selected).toEqual(sentinelFeature);
    expect(get(sFeatureData)).toBe(sentinelData);
    expect(get(sEvent)).toEqual({ type: 'viewAdjusted' });
    expect(get(overlays)[overlayId].currFeature).toBeUndefined();
    firstScreen.unmount();
    secondScreen.unmount();
  });

  test('activating an inactive map replays its sample and restores its owned overlay', async () => {
    mapTiles.set([0, 1]);
    const firstScreen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const firstMap = get(sMapp)!;
    const firstOverlay = new WebGLSpots(firstMap);
    overlays.update((current) => ({ ...current, [firstOverlay.uid]: firstOverlay }));
    sOverlay.set(firstOverlay.uid);
    const sample = new Sample({ name: 'inactive-then-active' });
    const hydrateSpy = vi.spyOn(sample, 'hydrate');
    const secondScreen = await render(MappPage, { props: { sample, uid: 1 } });
    await expect.poll(() => hydrateSpy.mock.calls.length).toBeGreaterThan(0);

    sMapId.set(1);
    await expect.poll(() => get(sMapp) !== firstMap).toBe(true);
    const secondMap = get(sMapp)!;
    const secondOverlay = new WebGLSpots(secondMap);
    const selectedSecondOverlay = new WebGLSpots(secondMap);
    overlays.update((current) => ({
      ...current,
      [secondOverlay.uid]: secondOverlay,
      [selectedSecondOverlay.uid]: selectedSecondOverlay
    }));
    sOverlay.set(selectedSecondOverlay.uid);
    await expect.poll(() => get(sEvent)?.type).toBe('sampleUpdated');

    sMapId.set(0);
    await expect.poll(() => get(sMapp)).toBe(firstMap);
    expect(get(sOverlay)).toBe(firstOverlay.uid);

    sMapId.set(1);
    await expect.poll(() => get(sMapp)).toBe(secondMap);
    expect(get(sOverlay)).toBe(selectedSecondOverlay.uid);
    firstScreen.unmount();
    secondScreen.unmount();
  });

  test('inactive maps do not consume hover state or retain active annotation interactions', async () => {
    mapTiles.set([0, 1]);
    const firstScreen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const firstMap = get(sMapp)!;
    sMapId.set(1);
    const secondScreen = await render(MappPage, { props: { sample: undefined, uid: 1 } });
    const secondMap = get(sMapp)!;
    const secondOverlay = new WebGLSpots(secondMap);
    const coords = new CoordsData({
      name: 'active-hover-owner',
      shape: 'circle',
      mPerPx: 1,
      size: 10,
      pos: [{ x: 2, y: 3, id: 'spot' }]
    });
    secondOverlay.coords = coords;
    overlays.update((current) => ({ ...current, [secondOverlay.uid]: secondOverlay }));
    sOverlay.set(secondOverlay.uid);
    sFeatureData.set({
      data: [7],
      dataType: 'quantitative',
      coords,
      minmax: [7, 7],
      name: { group: 'genes', feature: 'hover' }
    });
    firstMap.persistentLayers.active.visible = false;
    secondMap.persistentLayers.active.visible = false;

    sId.set({ source: 'test', idx: 0 });
    await tick();

    expect(firstMap.persistentLayers.active.visible).toBe(false);
    expect(firstMap.tippy?.elem.style.opacity).not.toBe('1');
    expect(firstMap.persistentLayers.annotations.select.getActive()).toBe(false);
    expect(firstMap.persistentLayers.annotations.points.select.getActive()).toBe(false);
    expect(firstMap.persistentLayers.rois.select.getActive()).toBe(false);
    expect(secondMap.persistentLayers.active.visible).toBe(true);
    expect(secondMap.tippy?.elem.style.opacity).toBe('1');
    expect(secondMap.persistentLayers.annotations.select.getActive()).toBe(true);
    expect(secondMap.persistentLayers.annotations.points.select.getActive()).toBe(true);
    expect(secondMap.persistentLayers.rois.select.getActive()).toBe(true);
    firstScreen.unmount();
    secondScreen.unmount();
  });

  test('tooltip hide timers are replaced, cancelled on resumed ID 0 hover, and cleared on teardown', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const tooltipTimers = () =>
      setTimeoutSpy.mock.calls.flatMap(([, delay], index) =>
        delay === 400
          ? [setTimeoutSpy.mock.results[index].value as ReturnType<typeof setTimeout>]
          : []
      );
    const screen = await render(MappPage, { props: { sample: undefined, uid: 0 } });
    const map = get(sMapp)!;
    const firstOverlay = get(overlays)[get(sOverlay)!];
    const secondOverlay = new WebGLSpots(map);
    overlays.update((current) => ({ ...current, [secondOverlay.uid]: secondOverlay }));
    const coords = new CoordsData({
      name: 'tooltip-id-zero',
      shape: 'circle',
      mPerPx: 1,
      size: 10,
      pos: [{ x: 2, y: 3, id: 0 }]
    });
    firstOverlay.coords = coords;
    secondOverlay.coords = coords;
    sFeatureData.set({
      data: [7],
      dataType: 'quantitative',
      coords,
      minmax: [7, 7],
      name: { group: 'genes', feature: 'tooltip' }
    });
    sId.set({ source: 'test', idx: 0 });
    await tick();

    expect(map.tippy?.elem.style.opacity).toBe('1');
    expect(map.tippy?.elem.textContent).toContain('0');
    const baselineTimerCount = tooltipTimers().length;

    sId.set({ source: 'test' });
    await tick();
    const firstHideTimer = tooltipTimers()[baselineTimerCount];
    if (firstHideTimer === undefined) throw new Error('First tooltip hide was not scheduled.');

    sOverlay.set(secondOverlay.uid);
    await tick();
    const replacementHideTimer = tooltipTimers()[baselineTimerCount + 1];
    if (replacementHideTimer === undefined) {
      throw new Error('Replacement tooltip hide was not scheduled.');
    }
    expect(clearTimeoutSpy).toHaveBeenCalledWith(firstHideTimer);

    sId.set({ source: 'test', idx: 0 });
    await tick();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(replacementHideTimer);
    expect(map.tippy?.elem.style.opacity).toBe('1');
    expect(map.tippy?.elem.textContent).toContain('0');

    sId.set({ source: 'test' });
    await tick();
    const teardownHideTimer = tooltipTimers()[baselineTimerCount + 2];
    if (teardownHideTimer === undefined)
      throw new Error('Teardown tooltip hide was not scheduled.');

    screen.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(teardownHideTimer);
    expect(map.map).toBeUndefined();
  });
});

test('pointermove listeners receive active spot hits', async () => {
  const coords = new CoordsData({
    name: 'hover-targets',
    shape: 'circle',
    mPerPx: 1,
    size: 100,
    pos: [
      { x: -20, y: -20, id: 'first' },
      { x: 0, y: 0, id: 'second' }
    ]
  });

  const { map, cleanup } = await renderMappHarness({ coords, highlightIdx: 1 });

  let lastHover: { idx: number; id: number | string } | null | undefined;
  map.attachPointerListener(
    {
      pointermove(info) {
        lastHover = info;
      }
    },
    { layer: map.persistentLayers.active.layer }
  );

  const olMap = map.map!;
  const target = olMap.getViewport();

  const coordinate = [coords.pos![1].x * coords.mPerPx, -coords.pos![1].y * coords.mPerPx];
  olMap.getView().setCenter(coordinate);
  olMap.getView().setZoom(6);
  olMap.renderSync();

  const pixel = olMap.getPixelFromCoordinate(coordinate);
  if (!pixel) throw new Error('Pixel lookup failed');

  const rect = target.getBoundingClientRect();
  const clientX = rect.left + pixel[0];
  const clientY = rect.top + pixel[1];

  target.dispatchEvent(
    new PointerEvent('pointermove', {
      clientX,
      clientY,
      bubbles: true,
      pointerType: 'mouse'
    })
  );

  await expect.poll(() => lastHover?.id).toBe('second');
  expect(lastHover?.idx).toBe(1);
  cleanup();
});

test('canvas outline renders all coordinate features when shown', async () => {
  const coords = new CoordsData({
    name: 'outline',
    shape: 'circle',
    mPerPx: 1,
    size: 50,
    pos: [
      { x: 5, y: 5, id: 'a' },
      { x: -5, y: 5, id: 'b' },
      { x: 0, y: 0, id: 'c' }
    ]
  });

  const { map, cleanup } = await renderMappHarness({ coords });

  const outline = new CanvasSpots(map);
  outline.mount();
  outline.visible = true;
  outline.update(coords);

  expect(outline.source.getFeatures().length).toBe(coords.pos!.length);
  expect(map.map!.getLayers().getArray()).toContain(outline.layer);
  cleanup();
});

test('pointer listeners can read feature intensity values from OpenLayers layers', async () => {
  const coords = new CoordsData({
    name: 'intensity',
    shape: 'circle',
    mPerPx: 1,
    size: 10,
    pos: [{ x: 12, y: -8, id: 'spot-1' }]
  });

  const { map, cleanup } = await renderMappHarness({ coords, highlightIdx: 0 });

  const source = new VectorSource();
  const layer = new VectorLayer({ source });
  const feature = new Feature({
    geometry: new Point([coords.pos![0].x * coords.mPerPx, -coords.pos![0].y * coords.mPerPx])
  });
  feature.setId(0);
  feature.set('value', 123.45);
  source.addFeature(feature);

  map.map!.addLayer(layer);

  let sampledValue: number | undefined;
  map.attachPointerListener(
    {
      pointermove(info) {
        sampledValue = info?.feature.get('value');
      }
    },
    { layer }
  );

  const olMap = map.map!;
  const target = olMap.getViewport();
  const coordinate = [coords.pos![0].x * coords.mPerPx, -coords.pos![0].y * coords.mPerPx];
  olMap.getView().setCenter(coordinate);
  olMap.getView().setZoom(6);
  olMap.renderSync();

  const pixel = olMap.getPixelFromCoordinate(coordinate);
  if (!pixel) throw new Error('Pixel lookup failed');
  const rect = target.getBoundingClientRect();
  const clientX = rect.left + pixel[0];
  const clientY = rect.top + pixel[1];
  target.dispatchEvent(
    new PointerEvent('pointermove', {
      clientX,
      clientY,
      bubbles: true,
      pointerType: 'mouse'
    })
  );

  await expect.poll(() => sampledValue).toBeCloseTo(123.45, 2);

  map.map!.removeLayer(layer);
  cleanup();
});
