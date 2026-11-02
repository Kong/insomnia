import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
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
  /** Dropdown whose trigger carries `data-testid="Dropdown-<name>"`. */
  static byTestId(page: Page, testId: string): DropdownComponent {
    return new DropdownComponent(page, page.getByTestId(testId));
  }

  /** Dropdown whose trigger button has the accessible name `name`. */
  static byLabel(page: Page, name: string | RegExp): DropdownComponent {
    return new DropdownComponent(page, page.getByRole("button", { name }));
  }

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

  async close(): Promise<void> {
    if (!(await this.menu.isVisible())) return;
    await this.page.keyboard.press("Escape");
    await expect(this.menu).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  async isOpen(): Promise<boolean> {
    return this.menu.isVisible();
  }

  /** Opens the menu and clicks the item called `name`. */
  async select(name: string | RegExp, exact = true): Promise<void> {
    await this.open();
    await this.item(name, exact).click();
  }

  /** Item labels currently shown (menu is opened if needed, then left open). */
  async itemNames(): Promise<string[]> {
    await this.open();
    return (
      await this.menu
        .getByRole("menuitem")
        .or(this.menu.getByRole("menuitemradio"))
        .allInnerTexts()
    ).map((t) => t.trim());
  }

  async isItemChecked(name: string | RegExp): Promise<boolean> {
    await this.open();
    return (
      (await this.item(name).getAttribute("aria-checked")) === "true"
    );
  }

  async isItemDisabled(name: string | RegExp): Promise<boolean> {
    await this.open();
    return (await this.item(name).getAttribute("aria-disabled")) === "true";
  }

  /** Opens the menu via right-click on `root` (context menus). */
  async openContextMenu(): Promise<void> {
    await this.root.click({ button: "right" });
    await expect(this.menu).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }
}
