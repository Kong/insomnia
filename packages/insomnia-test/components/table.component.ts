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

  row(name: string | RegExp): Locator {
    return this.root.getByRole("row", { name });
  }

  rowByText(text: string | RegExp): Locator {
    return this.rows.filter({ hasText: text });
  }

  async rowCount(): Promise<number> {
    return this.rows.count();
  }

  async rowNames(): Promise<string[]> {
    return this.rows.evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim() ?? ""),
    );
  }

  /** Cell texts of every body row (rows without `gridcell`s are skipped). */
  async cellTexts(): Promise<string[][]> {
    return this.rows.evaluateAll((rows) =>
      rows
        .map((row) =>
          Array.from(row.querySelectorAll('[role="gridcell"],[role="cell"]')).map(
            (c) => c.textContent?.trim() ?? "",
          ),
        )
        .filter((cells) => cells.length > 0),
    );
  }

  async selectRow(name: string | RegExp): Promise<void> {
    await this.row(name).click();
  }

  async hasRow(name: string | RegExp): Promise<boolean> {
    return (await this.row(name).count()) > 0;
  }
}
