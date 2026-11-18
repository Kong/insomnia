import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A react-aria `Table` / `GridList` (`role="grid"` + `role="row"`), used by
 * runner results, cookies, certificates, invites, commit file lists.
 * `root` is the grid (or a container with exactly one grid).
 */
export class TableComponent extends BaseComponent {
  get rows(): Locator {
    return this.root.getByRole("row");
  }

  rowByText(text: string | RegExp): Locator {
    return this.rows.filter({ hasText: text });
  }
}
