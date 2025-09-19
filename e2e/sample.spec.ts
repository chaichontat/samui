import { expect, test } from '@playwright/test';
import { VISIUM_URL as DEFAULT_VISIUM_URL } from './config';
import { SamuiPage } from './pages';

const VISIUM_URL = process.env.VISIUM_URL ?? DEFAULT_VISIUM_URL;

type SampleDefinition = {
  name: string;
  imgParams?: {
    channels?: string[];
    defaultChannels?: Record<string, string>;
  };
  overlayParams?: {
    importantFeatures?: { group: string; feature: string }[];
  };
  metadataMd?: { url: string } | null;
};

type ImageControllerState = {
  type: 'composite' | 'rgb';
  variables?: Record<string, { color: string; enabled: boolean }>;
};

function normalise(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function formatImportantFeatures(definition: SampleDefinition) {
  return (definition.overlayParams?.importantFeatures ?? []).map(
    ({ group, feature }) => `${group} > ${feature}`
  );
}

async function getFeatureButtons(page: import('@playwright/test').Page) {
  const texts = await page.getByTestId('feature-of-interest-button').allTextContents();
  return texts.map(normalise);
}

async function getImageControlState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('imgCtrl');
    return raw ? (JSON.parse(raw) as ImageControllerState) : null;
  });
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

function findChannelColor(
  defaults: Record<string, string> | undefined,
  channel: string | undefined
) {
  if (!defaults || !channel) return undefined;
  return Object.entries(defaults).find(([, value]) => value === channel)?.[0];
}

test.describe('Feature annotation sample switching', () => {
  test('keeps annotation stable and refreshes sample-specific UI', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    const visium = new SamuiPage(page);
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await visium.goto(VISIUM_URL);
    await visium.waitForHydration();

    const dataBaseUrl = await resolveDataBaseUrl(page);
    const activeSampleName = normalise(await visium.sampleSelect().innerText());
    const initialDefinition = await fetchSampleDefinition(page, dataBaseUrl, activeSampleName);

    await page.waitForFunction(() => localStorage.getItem('imgCtrl') !== null);

    const featureSection = page.locator('[data-test-id="sidebar-section-Feature Annotation"]');
    await featureSection.getByRole('button', { name: 'Feature Annotation' }).click();
    await page.getByRole('button', { name: 'Label' }).waitFor({ state: 'visible' });

    const initialFeatureButtons = await getFeatureButtons(page);
    expect(initialFeatureButtons).toEqual(formatImportantFeatures(initialDefinition));

    const initialController = await getImageControlState(page);
    expect(initialController?.type).toBe('composite');

    const availableChannels = initialDefinition.imgParams?.channels ?? [];
    expect(availableChannels.length).toBeGreaterThan(0);

    const targetChannel =
      Object.values(initialDefinition.imgParams?.defaultChannels ?? {})[0] ?? availableChannels[0];
    expect(targetChannel, 'target channel for colour verification').toBeTruthy();

    const defaultColor = findChannelColor(
      initialDefinition.imgParams?.defaultChannels,
      targetChannel!
    );
    const channelState = initialController?.variables?.[targetChannel!];
    expect(channelState?.enabled).toBe(true);
    if (defaultColor) {
      expect(channelState?.color).toBe(defaultColor);
    }

    const channelRow = page.getByRole('row', { name: `${targetChannel} controls` });
    await channelRow.waitFor();
    const colorButtons = channelRow.getByTestId('imgctrl-color-button');
    const buttonCount = await colorButtons.count();
    let newColorName: string | null = null;

    for (let index = 0; index < buttonCount; index += 1) {
      const button = colorButtons.nth(index);
      const label = await button.getAttribute('aria-label');
      if (!label) continue;
      const [color] = label.split(' ');
      if (!color) continue;
      if (!defaultColor || color !== defaultColor) {
        await button.click();
        newColorName = color;
        break;
      }
    }

    expect(newColorName, 'alternate colour button').toBeTruthy();
    if (defaultColor && newColorName) {
      expect(newColorName).not.toBe(defaultColor);
    }

    await page.waitForFunction(
      ({ channel, color }) => {
        const raw = localStorage.getItem('imgCtrl');
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw) as ImageControllerState;
          return parsed?.variables?.[channel]?.color === color;
        } catch (error) {
          console.error(error);
          return false;
        }
      },
      { channel: targetChannel!, color: newColorName }
    );

    const modifiedController = await getImageControlState(page);
    expect(modifiedController?.variables?.[targetChannel!]?.color).toBe(newColorName);

    // Collect sample names dynamically for switching
    await visium.sampleSelect().click();
    const optionItems = page.locator('[data-testid^="sample-option-"]');
    const sampleNames = (await optionItems.allTextContents()).map(normalise);
    await page.keyboard.press('Escape');

    const nextSampleName = sampleNames.find((name) => name !== activeSampleName);
    expect(nextSampleName, 'alternate sample to switch to').toBeTruthy();

    const nextDefinition = await fetchSampleDefinition(page, dataBaseUrl, nextSampleName!);

    await visium.selectSample(nextSampleName!);
    await visium.expectActiveSample(nextSampleName!);
    await visium.waitForHydration();
    await page.waitForFunction(() => localStorage.getItem('imgCtrl') !== null);

    await expect(visium.featuresOfInterestButtons()).toHaveCount(
      (nextDefinition.overlayParams?.importantFeatures ?? []).length
    );
    const postSwitchFeatures = await getFeatureButtons(page);
    expect(postSwitchFeatures).toEqual(formatImportantFeatures(nextDefinition));

    if (nextDefinition.metadataMd?.url) {
      const metadataSection = page.locator('[data-test-id="sidebar-section-Metadata"]');
      await metadataSection.getByRole('button', { name: 'Metadata' }).click();
      await expect(metadataSection.getByTestId('metadata-content')).toContainText(
        `Sample ID: ${nextDefinition.name}`,
        { timeout: 15000 }
      );
    }

    const controllerAfterSwitch = await getImageControlState(page);
    const channelAfterSwitch = controllerAfterSwitch?.variables?.[targetChannel!];
    expect(channelAfterSwitch?.color).toBe(newColorName);
    expect(channelAfterSwitch?.enabled).toBe(true);

    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
