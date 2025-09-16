import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { activeOverlayUid, getOverlayState, latestOverlayUid, waitForSamuiStores } from '../utils';

export class SamuiPage {
  constructor(private readonly page: Page) {}

  async goto(url: string) {
    await this.page.goto(url);
    await waitForSamuiStores(this.page);
  }

  async waitForHydration() {
    await this.page.waitForFunction(() => {
      const api = (window as any).__SAMUI__;
      return api?.stores?.sEvent?.()?.type === 'renderComplete';
    });
  }

  sampleSelect() {
    return this.page.getByTestId('sample-select');
  }

  sampleOption(name: string) {
    return this.page.getByTestId(`sample-option-${name}`);
  }

  metadataContent() {
    return this.page.getByTestId('metadata-content');
  }

  legend() {
    return this.page.getByTestId('overlay-legend');
  }

  featuresOfInterestButtons() {
    return this.page.getByTestId('feature-of-interest-button');
  }

  async expectActiveSample(name: string) {
    await expect(this.sampleSelect()).toHaveText(new RegExp(name));
  }

  async selectSample(name: string) {
    await this.sampleSelect().click();
    await this.sampleOption(name).click();
    await this.waitForHydration();
  }

  async currentOverlayState() {
    const uid = await activeOverlayUid(this.page);
    return uid ? await getOverlayState(this.page, uid) : {};
  }

  async addLayerAndSelectFeature(index: number) {
    await this.page.getByTestId('overlay-add-layer').click();
    const buttons = this.featuresOfInterestButtons();
    const featureButton = buttons.nth(index);
    await featureButton.waitFor({ state: 'visible' });
    const featureName = (await featureButton.innerText()).trim();
    await featureButton.click();
    const overlayUid = await latestOverlayUid(this.page);
    return { overlayUid, featureName };
  }
}
