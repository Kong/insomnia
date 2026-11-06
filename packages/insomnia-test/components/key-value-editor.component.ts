import type { Locator, Page } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { OneLineEditorComponent } from "./code-editor.component";

export interface KeyValueRow {
  name: string;
  value: string;
  disabled?: boolean;
}

/**
 * The name/value row list used by headers, params, form/url-encoded bodies,
 * mock headers and environments (`key-value-editor/key-value-editor.tsx`).
 * `root` is the container holding the `role="listbox"` of rows (usually the
 * owning tab panel).
 */
export class KeyValueEditorComponent extends BaseComponent {
  /**
   * @param hasTrailingBlankRow whether the editor keeps an always-present
   *   blank row at the end (new rows then need no explicit "Add").
   */
  constructor(
    page: Page,
    root: Locator,
    private readonly hasTrailingBlankRow = true,
  ) {
    super(page, root);
  }

  get rows(): Locator {
    return this.root.locator('[role="listbox"] [role="option"]');
  }

  /** Name cell editor of `row` (a row locator from `rows`). */
  nameEditor(row: Locator): OneLineEditorComponent {
    return new OneLineEditorComponent(
      this.page,
      row.getByTestId("OneLineEditor").nth(0),
    );
  }

  /** Value cell editor of `row`. */
  valueEditor(row: Locator): OneLineEditorComponent {
    return new OneLineEditorComponent(
      this.page,
      row.getByTestId("OneLineEditor").nth(1),
    );
  }

  get addButton(): Locator {
    return this.root.getByRole("button", { name: "Add", exact: true });
  }

  get deleteAllButton(): Locator {
    return this.root.getByRole("button", { name: "Delete all" });
  }

  async deleteAll(): Promise<void> {
    if (await this.deleteAllButton.isEnabled()) {
      await this.deleteAllButton.click();
    }
  }

  /** Reads every non-blank row, including its enabled/disabled toggle. */
  async read(): Promise<KeyValueRow[]> {
    const count = await this.rows.count();
    const pairs: KeyValueRow[] = [];
    for (let i = 0; i < count; i++) {
      const row = this.rows.nth(i);
      const name = await this.nameEditor(row).getValue();
      const value = await this.valueEditor(row).getValue();
      const toggle = row.locator("button[aria-pressed]");
      const enabled =
        (await toggle.count()) === 0
          ? true
          : (await toggle.getAttribute("aria-pressed")) === "true";
      if (name || value) pairs.push({ name, value, disabled: !enabled });
    }
    return pairs;
  }
}
