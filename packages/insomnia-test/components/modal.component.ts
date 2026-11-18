import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `Dialog` rendered by `base/modal.tsx` or
 * `basic-components/modal.tsx` (`role="dialog"`).
 *
 * Construct with no `root` for "the" open dialog, or pass a filtered
 * locator (e.g. by heading) when several can be open at once.
 */
export class ModalComponent extends BaseComponent {
  constructor(page: Page, root?: Locator) {
    super(page, root ?? page.getByRole("dialog"));
  }

  button(name: string | RegExp, exact = true): Locator {
    return this.root.getByRole("button", { name, exact });
  }

  async clickButton(name: string | RegExp, exact = true): Promise<void> {
    await this.button(name, exact).click();
  }

  /** Clicks the footer button `name` and waits for the modal to go away. */
  async confirm(name = "Done"): Promise<void> {
    await this.clickButton(name);
    await this.waitForHidden();
  }

  async expectOpen(timeout = DEFAULT_TIMEOUT): Promise<void> {
    await expect(this.root).toBeVisible({ timeout });
  }
}
