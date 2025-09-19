import { expect, test } from '@playwright/test';
import { promises as fs } from 'fs';
import { VISIUM_URL as DEFAULT_VISIUM_URL } from './config';
import { SamuiPage } from './pages';
import { waitForSamuiStores } from './utils';

const VISIUM_URL = process.env.VISIUM_URL ?? DEFAULT_VISIUM_URL;

type Coordinate = { x: number; y: number };

type SampleDefinition = {
  name: string;
  imgParams?: { mPerPx?: number };
  overlayParams?: { defaults?: { group: string; feature: string }[] };
  featParams?: { name: string; coordName?: string | null }[];
  coordParams?: { name: string }[];
};

type RoiFeature = {
  type: 'Feature';
  label: string;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
  properties?: Record<string, unknown>;
};

type RoiData = {
  type: 'FeatureCollection';
  sample: string;
  time: string;
  mPerPx: number;
  features: RoiFeature[];
};

type AnnFeatData = RoiData & { coordName: string };

function normalise(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

async function ensureDownload(
  download: import('@playwright/test').Download,
  fileName: string,
  testInfo: import('@playwright/test').TestInfo
) {
  const targetPath = testInfo.outputPath(fileName);
  await download.saveAs(targetPath);
  return targetPath;
}

function squareAround(point: Coordinate, mPerPx: number, spanPx = 60) {
  const baseX = point.x;
  const baseY = point.y;
  const delta = spanPx * mPerPx;
  return [
    [baseX - delta, baseY - delta],
    [baseX + delta, baseY - delta],
    [baseX + delta, baseY + delta],
    [baseX - delta, baseY + delta],
    [baseX - delta, baseY - delta]
  ];
}

async function waitForOverlayFeatures(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const stores = (window as any).__SAMUI__?.stores;
      if (!stores) return false;
      const overlayId = stores.sOverlay?.();
      const overlay = overlayId ? stores.overlays?.()?.[overlayId] : undefined;
      const features = overlay?.source?.getFeatures?.();
      return Boolean(features?.length);
    },
    null,
    { timeout: 20000 }
  );
}

async function resolveDataBaseUrl(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('url');
    if (!raw) throw new Error('Missing data url query parameter');
    const trimmed = raw.endsWith('/') ? raw : `${raw}/`;
    return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  });
}

async function fetchSampleDefinition(
  page: import('@playwright/test').Page,
  baseUrl: string,
  sampleName: string
) {
  return page.evaluate(
    async ({ baseUrl, sampleName }) => {
      const response = await fetch(`${baseUrl}${sampleName}/sample.json`);
      if (!response.ok) {
        throw new Error(`Failed to load definition for ${sampleName}: ${response.status}`);
      }
      return (await response.json()) as SampleDefinition;
    },
    { baseUrl, sampleName }
  );
}

function deriveCoordName(definition: SampleDefinition) {
  const defaultGroup = definition.overlayParams?.defaults?.[0]?.group;
  if (defaultGroup) {
    const match = definition.featParams?.find((feat) => feat.name === defaultGroup);
    if (match?.coordName) return match.coordName;
  }
  return definition.coordParams?.[0]?.name ?? 'spots';
}

async function getOverlayAnchor(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const stores = (window as any).__SAMUI__?.stores;
    if (!stores) throw new Error('Samui stores unavailable');
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const overlayId = stores.sOverlay?.();
      const overlay = overlayId ? stores.overlays?.()?.[overlayId] : undefined;
      const features = overlay?.source?.getFeatures?.();
      if (overlay && features?.length) {
        const geom = features[0].getGeometry?.();
        if (!geom) throw new Error('Overlay geometry unavailable');
        const coords = geom.getCoordinates();
        let anchor: Coordinate;
        if (Array.isArray(coords) && Array.isArray((coords as any)[0])) {
          const first = (coords as any)[0];
          anchor = { x: first[0] as number, y: first[1] as number };
        } else if (Array.isArray(coords)) {
          anchor = { x: (coords as number[])[0], y: (coords as number[])[1] };
        } else {
          throw new Error('Unsupported geometry for overlay feature');
        }
        return {
          coordName: overlay.coords?.name as string | undefined,
          mapPoint: anchor
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const overlayId = stores.sOverlay?.();
    const overlays = stores.overlays?.();
    const overlayKeys = overlays ? Object.keys(overlays) : [];
    throw new Error(
      `Overlay anchor unavailable (overlayId=${overlayId}, overlays=${overlayKeys.join(',')})`
    );
  });
}

async function loadRoiData(page: import('@playwright/test').Page, data: RoiData | AnnFeatData) {
  await page.evaluate((payload) => {
    const stores = (window as any).__SAMUI__?.stores;
    const map = stores?.sMapp?.();
    if (!map) throw new Error('Map not ready for ROI load');
    map.persistentLayers.rois.loadFeatures(payload);
  }, data);
}

async function loadFeatureAnnotationData(page: import('@playwright/test').Page, data: AnnFeatData) {
  await page.evaluate((payload) => {
    const stores = (window as any).__SAMUI__?.stores;
    const map = stores?.sMapp?.();
    if (!map) throw new Error('Map not ready for feature annotation load');
    map.persistentLayers.annotations.loadFeatures(payload);
  }, data);
}

test.describe('Annotation import/export', () => {
  test('ROI annotation exports and reimports JSON payloads', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    const visium = new SamuiPage(page);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const dialogMessages: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('dialog', (dialog) => {
      dialogMessages.push(dialog.message());
      dialog.accept();
    });

    await visium.goto(VISIUM_URL);
    await visium.waitForHydration();
    await expect
      .poll(async () => (await visium.currentOverlayState()).currFeature?.feature)
      .toBeTruthy();
    await waitForOverlayFeatures(page);

    const baseUrl = await resolveDataBaseUrl(page);
    const sampleName = normalise(await visium.sampleSelect().innerText());
    const sampleDefinition = await fetchSampleDefinition(page, baseUrl, sampleName);
    const mPerPx = sampleDefinition.imgParams?.mPerPx ?? 1;
    const anchor = await getOverlayAnchor(page);
    const roiLabel = 'Automated ROI';
    const roiData: RoiData = {
      type: 'FeatureCollection',
      sample: sampleName,
      time: new Date().toISOString(),
      mPerPx,
      features: [
        {
          type: 'Feature',
          label: roiLabel,
          geometry: {
            type: 'Polygon',
            coordinates: [squareAround(anchor.mapPoint, mPerPx)]
          }
        }
      ]
    };

    const roiSection = page.locator('[data-test-id="sidebar-section-ROI Annotation"]');
    await roiSection.getByRole('button', { name: 'ROI Annotation' }).click();

    await loadRoiData(page, roiData);

    await expect
      .poll(async () =>
        page.evaluate(() => (window as any).__SAMUI__?.stores?.annoROI?.()?.keys?.length ?? 0)
      )
      .toBeGreaterThan(0);
    await expect(
      roiSection.locator('label').filter({ hasText: new RegExp(`${roiLabel}\\s+1`) })
    ).toBeVisible();

    const downloads: import('@playwright/test').Download[] = [];
    page.on('download', (download) => downloads.push(download));

    const exportButton = roiSection.getByTestId('roi-export');
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    await expect.poll(() => downloads.length).toBe(1);

    const roiDownload = downloads[0];
    const roiPath = await ensureDownload(roiDownload, 'roi-export.json', testInfo);
    const exportedRaw = await fs.readFile(roiPath, 'utf8');
    const exported = JSON.parse(exportedRaw) as RoiData;

    expect(exported.sample).toBe(sampleName);
    expect(exported.features).toHaveLength(roiData.features.length);
    expect(exported.features[0].label).toBe(roiLabel);

    await page.reload();
    await waitForSamuiStores(page);
    await visium.waitForHydration();
    await waitForOverlayFeatures(page);
    await roiSection.getByRole('button', { name: 'ROI Annotation' }).click();
    await expect(roiSection.getByRole('button', { name: roiLabel })).toHaveCount(0);

    await loadRoiData(page, exported);

    await expect(
      roiSection.locator('label').filter({ hasText: new RegExp(`${roiLabel}\\s+1`) })
    ).toBeVisible();

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    expect(dialogMessages, dialogMessages.join('\n')).toEqual([]);
  });

  test('Feature annotation exports CSV/JSON and reimports JSON payloads', async ({
    page
  }, testInfo) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    const visium = new SamuiPage(page);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const dialogMessages: string[] = [];

    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('dialog', (dialog) => {
      dialogMessages.push(dialog.message());
      dialog.accept();
    });

    await visium.goto(VISIUM_URL);
    await visium.waitForHydration();
    await expect
      .poll(async () => (await visium.currentOverlayState()).currFeature?.feature)
      .toBeTruthy();
    await waitForOverlayFeatures(page);

    const baseUrl = await resolveDataBaseUrl(page);
    const sampleName = normalise(await visium.sampleSelect().innerText());
    const sampleDefinition = await fetchSampleDefinition(page, baseUrl, sampleName);
    const mPerPx = sampleDefinition.imgParams?.mPerPx ?? 1;
    const anchor = await getOverlayAnchor(page);
    const featureLabel = 'Automated Feature';

    const polygon = squareAround(anchor.mapPoint, mPerPx);
    const coordName = anchor.coordName ?? deriveCoordName(sampleDefinition);
    const featureData: AnnFeatData = {
      type: 'FeatureCollection',
      sample: sampleName,
      time: new Date().toISOString(),
      mPerPx,
      coordName,
      features: [
        {
          type: 'Feature',
          label: featureLabel,
          geometry: { type: 'Polygon', coordinates: [polygon] },
          properties: { polygon: 'auto-generated' }
        }
      ]
    };

    const featureSection = page.locator('[data-test-id="sidebar-section-Feature Annotation"]');
    await featureSection.getByRole('button', { name: 'Feature Annotation' }).click();

    await loadFeatureAnnotationData(page, featureData);

    await expect
      .poll(async () =>
        page.evaluate(() => (window as any).__SAMUI__?.stores?.annoFeat?.()?.keys?.length ?? 0)
      )
      .toBeGreaterThan(0);
    await expect(
      featureSection.locator('label').filter({ hasText: new RegExp(`${featureLabel}\\s+`) })
    ).toBeVisible();

    const downloads: import('@playwright/test').Download[] = [];
    page.on('download', (download) => downloads.push(download));

    const exportButton = featureSection.getByTestId('feature-export');
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    await expect.poll(() => downloads.length).toBe(2);

    const csvDownload = downloads.find((d) => d.suggestedFilename().endsWith('.csv'));
    const jsonDownload = downloads.find((d) => d.suggestedFilename().endsWith('.json'));
    if (!csvDownload || !jsonDownload)
      throw new Error('Missing expected downloads for feature export');

    const csvPath = await ensureDownload(csvDownload, 'feature-export.csv', testInfo);
    const jsonPath = await ensureDownload(jsonDownload, 'feature-export.json', testInfo);

    const csvContent = await fs.readFile(csvPath, 'utf8');
    expect(csvContent).toContain(featureLabel);

    const exportedRaw = await fs.readFile(jsonPath, 'utf8');
    const exported = JSON.parse(exportedRaw) as AnnFeatData;
    expect(exported.coordName).toBe(coordName);
    expect(exported.features[0].label).toBe(featureLabel);

    await page.reload();
    await waitForSamuiStores(page);
    await visium.waitForHydration();
    await waitForOverlayFeatures(page);
    await featureSection.getByRole('button', { name: 'Feature Annotation' }).click();
    await expect(featureSection.getByRole('button', { name: featureLabel })).toHaveCount(0);

    await loadFeatureAnnotationData(page, exported);

    await expect(
      featureSection.locator('label').filter({ hasText: new RegExp(`${featureLabel}\\s+`) })
    ).toBeVisible();

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
    expect(dialogMessages, dialogMessages.join('\n')).toEqual([]);
  });
});
