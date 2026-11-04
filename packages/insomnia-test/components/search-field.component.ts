import type { Locator, Page } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `SearchField` (`role="searchbox"`), e.g. the sidebar
 * "Projects filter". Locate by accessible name or placeholder.
 */
export class SearchFieldComponent extends BaseComponent {
  static byLabel(page: Page, name: string | RegExp): SearchFieldComponent {
    return new SearchFieldComponent(page, page.getByRole("searchbox", { name }));
  }

  static byPlaceholder(page: Page, placeholder: string | RegExp): SearchFieldComponent {
    return new SearchFieldComponent(page, page.getByPlaceholder(placeholder));
  }

  async search(text: string): Promise<void> {
    await this.root.fill(text);
  }

  async clear(): Promise<void> {
    await this.root.fill("");
  }

  async value(): Promise<string> {
    return this.root.inputValue();
  }

  /** The built-in clear (x) button that appears next to a non-empty sidebar filter field. */
  get clearButton(): Locator {
    return this.page
      .getByTestId("sidebar-search-field")
      .getByRole("button", { name: "Clear search" });
  }
}
