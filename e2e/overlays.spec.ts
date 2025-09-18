import { expect, test } from '@playwright/test';
import { VISIUM_URL as DEFAULT_VISIUM_URL } from './config';
import { SamuiPage } from './pages';
import { featureDataBounds, getOverlayState } from './utils';

const VISIUM_URL = process.env.VISIUM_URL ?? DEFAULT_VISIUM_URL;

function normaliseFeatureName(name: string) {
  const stripped = name.replace(/\s+/g, ' ').trim();
  const [, label] = stripped.split(' > ');
  return label ?? stripped;
}

function normaliseBounds(bounds: [number, number] | null) {
  if (!bounds) return null;
  return bounds.map((value) => Number(value?.toFixed(1))) as [number, number];
}

test.describe('Visium IF viewer', () => {
  test('hydrates default sample and overlay', async ({ page }) => {
    const visium = new SamuiPage(page);
    await visium.goto(VISIUM_URL);
    await visium.waitForHydration();

    await visium.expectActiveSample('Br2720_Ant_IF');
    await expect
      .poll(async () => (await visium.currentOverlayState()).currFeature?.feature)
      .toBeTruthy();
    const state = await visium.currentOverlayState();
    expect(state.currStyleVariables?.min).toBeDefined();
    expect(state.currStyleVariables?.max).toBeDefined();
  });

  test('switching sample updates metadata and overlay', async ({ page }) => {
    const visium = new SamuiPage(page);
    await visium.goto(VISIUM_URL);
    await visium.waitForHydration();

    await visium.selectSample('Br6432_Ant_IF');
    await visium.expectActiveSample('Br6432_Ant_IF');

    await expect
      .poll(async () => (await visium.currentOverlayState()).currFeature?.feature)
      .toBeTruthy();
  });

  test('adds layer and customises colour map', async ({ page }) => {
    const visium = new SamuiPage(page);
    await visium.goto(VISIUM_URL);
    await visium.waitForHydration();

    const featureButtons = await visium.featuresOfInterestButtons().allTextContents();
    const targetIndex = featureButtons.findIndex((name) => /genes/i.test(name));
    const index = targetIndex >= 0 ? targetIndex : 0;

    const overlayRows = page.locator('[data-testid^="overlay-row-"]');
    const baseCount = await overlayRows.count();

    const { overlayUid, featureName } = await visium.addLayerAndSelectFeature(index);
    expect(overlayUid, 'new overlay uid').toBeTruthy();

    const featureId = normaliseFeatureName(featureName);
    await expect
      .poll(async () =>
        normaliseFeatureName((await getOverlayState(page, overlayUid!)).currFeature?.feature ?? '')
      )
      .toBe(featureId);

    let overlayState = await getOverlayState(page, overlayUid!);
    await expect
      .poll(async () => (await getOverlayState(page, overlayUid!)).visible === true)
      .toBeTruthy();
    overlayState = await getOverlayState(page, overlayUid!);

    await expect(overlayRows).toHaveCount(baseCount + 1);
    const overlayRow = overlayRows.last();
    await overlayRow.getByTestId('overlay-colormap').click();
    await page.getByTestId('overlay-colormap-option-blues').click();

    await expect
      .poll(async () => (await getOverlayState(page, overlayUid!)).currColorMap)
      .toBe('blues');
    overlayState = await getOverlayState(page, overlayUid!);

    const maxInput = page.getByTestId('overlay-max');
    await maxInput.fill('2.5');
    await maxInput.press('Enter');

    await expect
      .poll(async () => (await getOverlayState(page, overlayUid!)).currStyleVariables?.max ?? 0)
      .toBeCloseTo(2.5, 1);

    await page.getByRole('button', { name: 'Auto' }).click();
    overlayState = await getOverlayState(page, overlayUid!);

    const bounds = normaliseBounds(await featureDataBounds(page));
    if (bounds) {
      const [autoMin, autoMax] = bounds;
      await expect
        .poll(async () =>
          Number((await getOverlayState(page, overlayUid!)).currStyleVariables?.min?.toFixed(1))
        )
        .toBe(autoMin);
      await expect
        .poll(async () =>
          Number((await getOverlayState(page, overlayUid!)).currStyleVariables?.max?.toFixed(1))
        )
        .toBe(autoMax);
    }

    await expect(visium.legend().getByText(featureId)).toBeVisible();
  });
});
