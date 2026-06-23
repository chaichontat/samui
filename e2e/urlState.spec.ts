import { expect, test, type Page } from '@playwright/test';

// A single sample keeps the network load light for these viewport-focused tests.
const DATA_BASE = process.env.URLSTATE_DATA_BASE ?? 'data.samuibrowser.com/VisiumIF/';
const SAMPLE = process.env.URLSTATE_SAMPLE ?? 'Br2720_Ant_IF';
const SECOND_SAMPLE = process.env.URLSTATE_SECOND_SAMPLE ?? 'Br6432_Ant_IF';
const LOAD_URL = `/from?url=${DATA_BASE}&s=${SAMPLE}`;
const MULTI_LOAD_URL = `/from?url=${DATA_BASE}&s=${SAMPLE}&s=${SECOND_SAMPLE}`;

// Remote sample loading over the network can be slow; give it room.
test.describe.configure({ timeout: 90000 });

// Wait until the map exists and its view has been fit (a center is set). Avoids
// the `renderComplete` edge-trigger, whose transient value the poller can miss.
async function gotoSamui(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !!(window as any).__SAMUI__?.stores?.sMapp?.()?.map?.getView?.()?.getCenter?.(),
    null,
    { timeout: 60000 }
  );
}

async function importantFeature(page: Page, sample: string) {
  const manifest = await page.request.get(`https://${DATA_BASE}${sample}/sample.json`);
  expect(manifest.ok(), `${sample}/sample.json reachable`).toBeTruthy();
  const important = ((await manifest.json()).overlayParams?.importantFeatures ?? []) as {
    group: string;
    feature: string;
  }[];
  expect(important.length, `${sample} has an important feature to restore`).toBeGreaterThan(0);
  return important[0];
}

// Same pixel<->meter convention as src/lib/ui/urlState.ts (y axis negated).
async function readView(page: Page) {
  return page.evaluate(() => {
    const stores = (window as any).__SAMUI__.stores;
    const mapp = stores.sMapp();
    const mPerPx = mapp.mPerPx as number;
    const center = mapp.map.getView().getCenter() as [number, number];
    return {
      pixelX: center[0] / mPerPx,
      pixelY: -center[1] / mPerPx,
      zoom: mapp.map.getView().getZoom() as number,
      feature: stores.overlays()[stores.sOverlay()]?.currFeature as
        | { group: string; feature: string }
        | undefined
    };
  });
}

async function waitForRestoredView(
  page: Page,
  target: { sample?: string; x: number; y: number; z: number; group: string; feature: string }
) {
  await page.waitForFunction(
    ({ sample, x, y, z, group, feature }) => {
      if (sample) {
        const sampleSelect = document.querySelector('[data-testid="sample-select"]');
        if (!sampleSelect?.textContent?.includes(sample)) return false;
      }

      const stores = (window as any).__SAMUI__.stores;
      const mapp = stores.sMapp?.();
      const view = mapp?.map?.getView?.();
      if (!view || mapp.mPerPx == null) return false;
      const c = view.getCenter();
      if (!c) return false;
      const cf = stores.overlays()[stores.sOverlay()]?.currFeature;
      return (
        Math.abs(c[0] / mapp.mPerPx - x) <= 1 &&
        Math.abs(-c[1] / mapp.mPerPx - y) <= 1 &&
        Math.abs((view.getZoom() ?? 0) - z) <= 0.02 &&
        cf?.group === group &&
        cf?.feature === feature
      );
    },
    target,
    { timeout: 30000 }
  );
}

test.describe('URL viewer-state sync', () => {
  test('restores center, zoom, and feature from the query string', async ({ page }) => {
    const { group, feature } = await importantFeature(page, SAMPLE);

    const targetX = 6000;
    const targetY = 6000;
    const targetZoom = 4.2;
    const restoreUrl =
      `${LOAD_URL}&x=${targetX}&y=${targetY}&z=${targetZoom}` +
      `&g=${encodeURIComponent(group)}&f=${encodeURIComponent(feature)}`;

    await gotoSamui(page, restoreUrl);

    // Restore lands after renderComplete and the feature reload; poll until settled.
    await waitForRestoredView(page, {
      x: targetX,
      y: targetY,
      z: targetZoom,
      group,
      feature
    });

    const view = await readView(page);
    expect(Math.round(view.pixelX)).toBe(targetX);
    expect(Math.round(view.pixelY)).toBe(targetY);
    expect(view.zoom).toBeCloseTo(targetZoom, 1);
    expect(view.feature).toEqual({ group, feature });
  });

  test('restores the requested sample from a multi-sample shared URL before writing state', async ({
    page
  }) => {
    const { group, feature } = await importantFeature(page, SECOND_SAMPLE);

    const targetX = 6000;
    const targetY = 6000;
    const targetZoom = 4.2;
    const restoreUrl =
      `${MULTI_LOAD_URL}&sample=${encodeURIComponent(SECOND_SAMPLE)}` +
      `&x=${targetX}&y=${targetY}&z=${targetZoom}` +
      `&g=${encodeURIComponent(group)}&f=${encodeURIComponent(feature)}`;

    await gotoSamui(page, restoreUrl);

    await waitForRestoredView(page, {
      sample: SECOND_SAMPLE,
      x: targetX,
      y: targetY,
      z: targetZoom,
      group,
      feature
    });

    await expect(page.getByTestId('sample-select')).toContainText(SECOND_SAMPLE);
    const params = new URLSearchParams(new URL(page.url()).search);
    expect(params.get('url')).toBe(DATA_BASE);
    expect(params.getAll('s')).toEqual([SAMPLE, SECOND_SAMPLE]);
    expect(params.get('sample')).toBe(SECOND_SAMPLE);
    expect(params.get('g')).toBe(group);
    expect(params.get('f')).toBe(feature);
  });

  test('writes the displayed image channels to the query string and restores them', async ({
    page
  }) => {
    await gotoSamui(page, LOAD_URL);

    // The composite controller initialises after the image loads and writes its
    // enabled channels to `c` (debounced ~300ms). Preserve the load params.
    await page.waitForFunction(() => !!new URLSearchParams(window.location.search).get('c'), null, {
      timeout: 30000
    });
    const defaults = new URLSearchParams(new URL(page.url()).search);
    expect(defaults.get('url')).toBeTruthy();
    expect(defaults.getAll('s')).toContain(SAMPLE);

    // Take one of the displayed channels and pin it to a single color, then reload.
    const firstChannel = defaults.get('c')!.split(',')[0].split(':')[0];
    const restoreUrl = `${LOAD_URL}&c=${encodeURIComponent(`${firstChannel}:white`)}`;
    await gotoSamui(page, restoreUrl);

    // The restored selection flows into the controller, which persists to localStorage
    // on every style update — assert exactly that one channel is enabled, in white.
    await page.waitForFunction(
      (channel) => {
        const raw = localStorage.getItem('imgCtrl');
        if (!raw) return false;
        const ctrl = JSON.parse(raw);
        if (ctrl?.type !== 'composite') return false;
        const target = ctrl.variables[channel];
        if (!target?.enabled || target.color !== 'white') return false;
        return Object.entries(ctrl.variables).every(
          ([name, info]) => name === channel || !(info as { enabled: boolean }).enabled
        );
      },
      firstChannel,
      { timeout: 30000 }
    );
  });

  test('writes center and zoom to the query string on map move, preserving load params', async ({
    page
  }) => {
    await gotoSamui(page, LOAD_URL);

    // Drive a real moveend (programmatic setCenter/setZoom does not emit one).
    await page.evaluate(() => {
      const mapp = (window as any).__SAMUI__.stores.sMapp();
      const m = mapp.mPerPx as number;
      mapp.map.getView().animate({ center: [3000 * m, -3000 * m], zoom: 5, duration: 1 });
    });

    // Writes are debounced (~300ms) via history.replaceState.
    await page.waitForFunction(
      () => {
        const p = new URLSearchParams(window.location.search);
        return p.get('x') === '3000' && p.get('y') === '3000' && p.get('z') === '5';
      },
      null,
      { timeout: 10000 }
    );

    // The sample-loading params survive the rewrite.
    const params = new URLSearchParams(new URL(page.url()).search);
    expect(params.get('url')).toBeTruthy();
    expect(params.getAll('s')).toContain(SAMPLE);
  });
});
