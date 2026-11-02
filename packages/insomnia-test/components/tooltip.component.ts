import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `Tooltip` (`tooltip.tsx`, `help-tooltip.tsx`). `root` is the
 * trigger element; the tooltip itself (`role="tooltip"`) is portalled.
 */
export class TooltipComponent extends BaseComponent {
  /** Trigger located by its aria-label. */
  static byLabel(page: Page, label: string | RegExp): TooltipComponent {
    return new TooltipComponent(page, page.getByLabel(label));
  }

  get tooltip(): Locator {
    return this.page.getByRole("tooltip");
  }

  /** Hovers the trigger and returns the tooltip text ("" if no trigger). */
  async read(): Promise<string> {
    if (!(await this.root.isVisible())) return "";
    await this.root.hover();
    await expect(this.tooltip).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const text = (await this.tooltip.innerText()).trim();
    await this.dismiss();
    return text;
  }

  async expectText(
    expected: string | RegExp,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<void> {
    await this.root.hover();
    await expect(this.tooltip).toHaveText(expected, { timeout });
    await this.dismiss();
  }

  /** Moves the pointer away so the tooltip closes. */
  async dismiss(): Promise<void> {
    await this.page.mouse.move(0, 0);
  }
}
