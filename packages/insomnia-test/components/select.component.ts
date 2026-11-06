import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `Select` (`base/select.tsx`, `basic-components/select-popover.tsx`,
 * "Change Body Type"-style pickers). `root` is the trigger button. The popup
 * `listbox` is portalled, so options are located from the page.
 *
 * react-aria also renders a hidden native `<select>` inside
 * `data-testid="hidden-select-container"`; it is used to verify the value.
 */
export class SelectComponent extends BaseComponent {
  // Scoped to the Select popover: pages such as the multipart body editor also
  // render their own listbox ("Key-value pairs"), which would trip strict mode.
  get listbox(): Locator {
    return this.page.locator('[data-trigger="Select"]').getByRole("listbox");
  }

  option(keyOrName: string | RegExp): Locator {
    return typeof keyOrName === "string"
      ? this.page.locator(`[role="option"][data-key="${keyOrName}"]`)
      : this.listbox.getByRole("option", { name: keyOrName });
  }

  async open(): Promise<void> {
    await expect(async () => {
      if (!(await this.listbox.isVisible())) await this.root.click();
      await expect(this.listbox).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the list and picks an option by `data-key` (string) or visible
   * name (RegExp). Uses a synthetic click, which is what react-aria options
   * inside popovers reliably respond to under test.
   */
  async select(keyOrName: string | RegExp): Promise<void> {
    await this.open();
    await this.option(keyOrName).dispatchEvent("click");
    await expect(this.listbox).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /** Value of the hidden native `<select>` that mirrors the selection. */
  async nativeValue(scope: Locator = this.page.locator("body")): Promise<string> {
    return scope
      .locator('[data-testid="hidden-select-container"] select')
      .first()
      .inputValue();
  }
}

