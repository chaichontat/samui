import type { Page } from '@playwright/test';

type OverlayState = {
  currFeature?: { group: string; feature: string };
  currStyleVariables?: { opacity?: number; min?: number; max?: number };
  currColorMap?: string;
  visible?: boolean;
  outlineVisible?: boolean;
  view?: { zoom?: number; center?: number[] | null };
};

export async function waitForSamuiStores(page: Page) {
  await page.waitForFunction(() => {
    const api = (window as any).__SAMUI__;
    return Boolean(api?.stores?.sMapp);
  });
}

export async function waitForRenderComplete(page: Page) {
  await page.waitForFunction(() => {
    const api = (window as any).__SAMUI__;
    return api?.stores?.sEvent?.()?.type === 'renderComplete';
  });
}

export async function activeOverlayUid(page: Page) {
  return page.evaluate(() => {
    const api = (window as any).__SAMUI__;
    return api?.stores?.sOverlay?.();
  });
}

export async function latestOverlayUid(page: Page) {
  return page.evaluate(() => {
    const api = (window as any).__SAMUI__;
    const overlays = api?.stores?.overlays?.() ?? {};
    const keys = Object.keys(overlays);
    return keys[keys.length - 1];
  });
}

export async function getOverlayState(page: Page, uid: string): Promise<OverlayState> {
  return page.evaluate((overlayUid) => {
    const api = (window as any).__SAMUI__;
    const stores = api?.stores;
    if (!stores) return {};
    const mapp = stores.sMapp?.();
    const overlays = stores.overlays?.();
    const overlay = overlays?.[overlayUid];
    const view = mapp?.map?.getView?.();
    return {
      currFeature: overlay?.currFeature,
      currStyleVariables: overlay?.currStyleVariables,
      currColorMap: overlay?.currColorMap,
      visible: overlay?.layer?.getVisible?.(),
      outlineVisible: overlay?.outline?.visible,
      view: {
        zoom: view?.getZoom?.(),
        center: view?.getCenter?.() ?? null
      }
    } satisfies OverlayState;
  }, uid);
}

export async function featureDataBounds(page: Page) {
  return page.evaluate(() => {
    const api = (window as any).__SAMUI__;
    return api?.stores?.sFeatureData?.()?.minmax ?? null;
  });
}
