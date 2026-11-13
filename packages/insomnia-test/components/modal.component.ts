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

  /** Modal whose heading matches `title`. */
  static byTitle(page: Page, title: string | RegExp): ModalComponent {
    return new ModalComponent(
      page,
      page
        .getByRole("dialog")
        .filter({ has: page.getByRole("heading", { name: title }) }),
    );
  }

  /** Modal identified by the `data-testid` on its content wrapper. */
  static byTestId(page: Page, testId: string): ModalComponent {
    return new ModalComponent(
      page,
      page.getByRole("dialog").filter({ has: page.getByTestId(testId) }),
    );
  }

  get heading(): Locator {
    return this.root.getByRole("heading").first();
  }

  async title(): Promise<string> {
    return (await this.heading.innerText()).trim();
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

  /** Closes via the header's `x` icon button. */
  async close(): Promise<void> {
    await this.root.locator('[data-icon="x"]').first().click();
    await this.waitForHidden();
  }

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.waitForHidden();
  }

  async expectOpen(timeout = DEFAULT_TIMEOUT): Promise<void> {
    await expect(this.root).toBeVisible({ timeout });
  }
}
