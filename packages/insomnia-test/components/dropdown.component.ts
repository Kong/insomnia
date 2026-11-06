import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A `MenuTrigger` + `Popover` + `Menu` dropdown (`base/dropdown/*`,
 * `dropdowns/*`). `root` is the trigger button; the popup menu is portalled
 * to the document body, so it is located from the page, not from `root`.
 *
 * Items may render as `menuitem` or, for single-choice entries,
 * `menuitemradio`; both are matched.
 */
export class DropdownComponent extends BaseComponent {
  get menu(): Locator {
    return this.page.getByRole("menu");
  }

  item(name: string | RegExp, exact = true): Locator {
    const menu = this.menu;
    return menu
      .getByRole("menuitem", { name, exact })
      .or(menu.getByRole("menuitemradio", { name, exact }));
  }

  async open(): Promise<void> {
    if (await this.menu.isVisible()) return;
    await expect(async () => {
      await this.root.click();
      await expect(this.menu).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /** Opens the menu and clicks the item called `name`. */
  async select(name: string | RegExp, exact = true): Promise<void> {
    await this.open();
    await this.item(name, exact).click();
  }
}
