import { expect, test } from '@playwright/test';

// A single sample keeps the network load light for these viewport-focused tests.
const DATA_BASE = process.env.URLSTATE_DATA_BASE ?? 'data.samuibrowser.com/VisiumIF/';
const SAMPLE = process.env.URLSTATE_SAMPLE ?? 'Br2720_Ant_IF';
const LOAD_URL = `/from?url=${DATA_BASE}&s=${SAMPLE}`;

// Remote sample loading over the network can be slow; give it room.
test.describe.configure({ timeout: 90000 });

// Wait until the map exists and its view has been fit (a center is set). Avoids
// the `renderComplete` edge-trigger, whose transient value the poller can miss.
async function gotoSamui(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !!(window as any).__SAMUI__?.stores?.sMapp?.()?.map?.getView?.()?.getCenter?.(),
    null,
    { timeout: 60000 }
  );
}

// Same pixel<->meter convention as src/lib/ui/urlState.ts (y axis negated).
async function readView(page: import('@playwright/test').Page) {
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

test.describe('URL viewer-state sync', () => {
  test('restores center, zoom, and feature from the query string', async ({ page }) => {
    // Pull a real feature from the sample manifest without loading the whole app.
    const manifest = await page.request.get(`https://${DATA_BASE}${SAMPLE}/sample.json`);
    expect(manifest.ok(), 'sample.json reachable').toBeTruthy();
    const important = ((await manifest.json()).overlayParams?.importantFeatures ?? []) as {
      group: string;
      feature: string;
    }[];
    expect(important.length, 'an important feature to restore').toBeGreaterThan(0);
    const { group, feature } = important[0];

    const targetX = 6000;
    const targetY = 6000;
    const targetZoom = 4.2;
    const restoreUrl =
      `${LOAD_URL}&x=${targetX}&y=${targetY}&z=${targetZoom}` +
      `&g=${encodeURIComponent(group)}&f=${encodeURIComponent(feature)}`;

    await gotoSamui(page, restoreUrl);

    // Restore lands after renderComplete and the feature reload; poll until settled.
    await page.waitForFunction(
      ({ x, y, z, g, f }) => {
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
          cf?.group === g &&
          cf?.feature === f
        );
      },
      { x: targetX, y: targetY, z: targetZoom, g: group, f: feature },
      { timeout: 30000 }
    );

    const view = await readView(page);
    expect(Math.round(view.pixelX)).toBe(targetX);
    expect(Math.round(view.pixelY)).toBe(targetY);
    expect(view.zoom).toBeCloseTo(targetZoom, 1);
    expect(view.feature).toEqual({ group, feature });
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
