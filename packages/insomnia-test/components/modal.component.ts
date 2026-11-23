import type { Locator,Page } from "@playwright/test";

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

  async closeWithEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.waitForHidden();
  }
}
