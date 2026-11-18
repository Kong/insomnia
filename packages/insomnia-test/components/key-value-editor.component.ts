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

  async rowCount(): Promise<number> {
    return this.rows.count();
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

  /** Replaces all rows with `pairs`. */
  async set(pairs: KeyValueRow[]): Promise<void> {
    await this.deleteAll();
    for (const [index, pair] of pairs.entries()) {
      if (!this.hasTrailingBlankRow && index > 0) {
        await this.addButton.click();
      }
      // Index fixed up front: once persisted a new trailing blank row is
      // appended, so `.last()` would no longer be the row being edited.
      const row = this.rows.nth((await this.rows.count()) - 1);
      await this.nameEditor(row).setValue(pair.name);
      await this.valueEditor(row).setValue(pair.value);
      if (pair.disabled) {
        await row.locator("button[aria-pressed]").click();
      }
    }
  }

  /** Switches the single row at `index` on/off. */
  async setRowEnabled(index: number, enabled: boolean): Promise<void> {
    const toggle = this.rows.nth(index).locator("button[aria-pressed]");
    const current = (await toggle.getAttribute("aria-pressed")) === "true";
    if (current !== enabled) await toggle.click();
  }

  /** Drags row `from` onto row `to` via the grip handle. */
  async dragRow(from: number, to: number): Promise<void> {
    await this.rows
      .nth(from)
      .locator('[data-icon="grip-vertical"]')
      .dragTo(this.rows.nth(to));
  }
}
