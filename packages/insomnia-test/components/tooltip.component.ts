import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `Tooltip` (`tooltip.tsx`, `help-tooltip.tsx`). `root` is the
 * trigger element; the tooltip itself (`role="tooltip"`) is portalled.
 */
export class TooltipComponent extends BaseComponent {
  get tooltip(): Locator {
    return this.page.getByRole("tooltip");
  }
}
