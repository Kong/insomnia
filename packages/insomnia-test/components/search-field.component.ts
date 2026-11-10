import type { Page } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `SearchField` (`role="searchbox"`), e.g. the sidebar
 * "Projects filter". Locate by accessible name or placeholder.
 */
export class SearchFieldComponent extends BaseComponent {
  static byLabel(page: Page, name: string | RegExp): SearchFieldComponent {
    return new SearchFieldComponent(page, page.getByRole("searchbox", { name }));
  }

  async search(text: string): Promise<void> {
    await this.root.fill(text);
  }
}
