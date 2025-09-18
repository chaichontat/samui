import type { Page } from '@playwright/test';

type OverlayState = {
  currFeature?: { group: string; feature: string };
  currStyleVariables?: { opacity?: number; min?: number; max?: number };
  currColorMap?: string;
  visible?: boolean;
  outlineVisible?: boolean;
  view?: { zoom?: number; center?: number[] | null };
};

export async function waitForOverlayPanel(page: Page) {
  await page.waitForSelector('[data-testid="overlay-table"]');
}

export async function waitForRenderComplete(page: Page) {
  await page.waitForFunction(() => {
    const table = document.querySelector('[data-testid="overlay-table"]');
    if (!table) return false;
    if (table.getAttribute('data-render-complete') === 'true') return true;
    if (document.body.dataset.renderComplete === 'true') return true;
    return false;
  });
}

export async function activeOverlayUid(page: Page) {
  const row = page.locator('[data-testid^="overlay-row-"][data-selected="true"]');
  if (!(await row.count())) return undefined;
  return row.first().getAttribute('data-overlay-uid');
}

export async function latestOverlayUid(page: Page) {
  const row = page.locator('[data-testid^="overlay-row-"]').last();
  if (!(await row.count())) return undefined;
  return row.getAttribute('data-overlay-uid');
}

export async function getOverlayState(page: Page, uid: string): Promise<OverlayState> {
  const locator = page.locator(`[data-overlay-uid="${uid}"]`);
  return locator.evaluate((row) => {
    const dataset = row.dataset;
    const table = row.closest('[data-testid="overlay-table"]') as HTMLElement | null;
    const feature = dataset.overlayFeature;
    const group = dataset.overlayGroup;
    const min =
      dataset.overlayMin && dataset.overlayMin !== '' ? Number(dataset.overlayMin) : undefined;
    const max =
      dataset.overlayMax && dataset.overlayMax !== '' ? Number(dataset.overlayMax) : undefined;
    const opacity =
      dataset.overlayOpacity && dataset.overlayOpacity !== ''
        ? Number(dataset.overlayOpacity)
        : undefined;
    const hasMin = typeof min === 'number' && Number.isFinite(min);
    const hasMax = typeof max === 'number' && Number.isFinite(max);
    const hasOpacity = typeof opacity === 'number' && Number.isFinite(opacity);

    return {
      currFeature: feature ? { feature, group: group ?? '' } : undefined,
      currStyleVariables:
        hasMin || hasMax || hasOpacity
          ? {
              min: hasMin ? min : undefined,
              max: hasMax ? max : undefined,
              opacity: hasOpacity ? opacity : undefined
            }
          : undefined,
      currColorMap: dataset.overlayColormap || undefined,
      visible: dataset.overlayVisible === 'true',
      outlineVisible: dataset.overlayOutlineVisible === 'true',
      view: {
        zoom: table && table.dataset.viewZoom ? Number(table.dataset.viewZoom) : undefined,
        center:
          table && table.dataset.viewCenter
            ? table.dataset.viewCenter.split(',').filter(Boolean).map(Number)
            : null
      }
    } satisfies OverlayState;
  });
}

export async function featureDataBounds(page: Page) {
  const locator = page.locator('[data-testid="overlay-table"]');
  if (!(await locator.count())) return null;
  return locator.evaluate((table) => {
    const min = table.dataset.featureMin;
    const max = table.dataset.featureMax;
    if (!min || !max) return null;
    return [Number(min), Number(max)] as [number, number];
  });
}
