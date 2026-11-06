import type { Locator, Page } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * `basic-components/banner.tsx` / `warning-banner.tsx` inline banners. Locate
 * by `aria-label` or by `data-testid` (warning banners accept one).
 */
export class BannerComponent extends BaseComponent {
  static byTestId(page: Page, testId: string): BannerComponent {
    return new BannerComponent(page, page.getByTestId(testId));
  }

  static byLabel(page: Page, label: string): BannerComponent {
    return new BannerComponent(page, page.getByLabel(label, { exact: true }));
  }

  async text(): Promise<string> {
    return (await this.root.isVisible()) ? (await this.root.innerText()).trim() : "";
  }

  get title(): Locator {
    return this.root.getByTestId("banner-title");
  }
}
