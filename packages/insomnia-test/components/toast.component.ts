import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * The global react-aria toast region rendered by `toast-notification.tsx`
 * (`Toaster`). Each toast has a title and optional description.
 */
export class ToastComponent extends BaseComponent {
  constructor(page: Page) {
    super(page, page.getByRole("region").filter({ has: page.getByRole("alertdialog") }));
  }

  /** Toast containing `text` in its title or description. */
  toast(text: string | RegExp): Locator {
    return this.page.getByRole("alertdialog").filter({ hasText: text });
  }

  async waitForToast(
    text: string | RegExp,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<void> {
    await expect(this.toast(text).first()).toBeVisible({ timeout });
  }
}
