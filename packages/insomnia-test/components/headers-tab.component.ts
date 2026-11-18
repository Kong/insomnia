import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { findDocs } from "@package/misc/db";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { KeyValueRow } from "./key-value-editor.component";
import { KeyValueEditorComponent } from "./key-value-editor.component";
import { PromptButtonComponent } from "./prompt-button.component";
import { TabPanelComponent } from "./tab-panel.component";

const DEFAULT_ROWS = [
  { name: "Accept", value: "*/*" },
  { name: "Host", value: "<calculated at runtime>" },
];

/**
 * The Headers tab of a collection's or a folder's own pane (the request's
 * pane keeps its own implementation in `RequestPage`). `dbFile` is the
 * model file the owning document persists to, used to confirm each debounced
 * save has landed before the next edit builds on it:
 * `insomnia.Workspace.db` for a collection, `insomnia.RequestGroup.db` for
 * a folder.
 */
export class HeadersTabComponent extends TabPanelComponent {
  constructor(
    page: Page,
    PANE: string,
    private readonly dbFile: string,
  ) {
    super(page, PANE);
  }

  private get keyValue(): KeyValueEditorComponent {
    return new KeyValueEditorComponent(this.page, this.page.locator(this.TABPANEL));
  }

  /** Reads back every non-blank row, including its enabled/disabled toggle. */
  async getHeaders(): Promise<KeyValueRow[]> {
    await this.switchTab("headers");
    const rows = await this.keyValue.read();
    // The editor always lists the read-only defaults ("Accept", "Host") the request adds at runtime.
    return rows.filter((row) => !DEFAULT_ROWS.some((d) => d.name === row.name && d.value === row.value));
  }

  /**
   * Replaces the headers: deletes the existing rows, then adds one row per
   * header, toggling it off if `disabled`. A header with an empty `name`
   * only gets its value typed, which leaves a nameless row.
   */
  async setHeaders(headers: KeyValueRow[]): Promise<void> {
    await this.switchTab("headers");
    const previous = await this.getHeaders();
    const rows = this.keyValue.rows;
    if (previous.length > 0) {
      // "Delete all" is a prompt button (first click asks, second confirms) whose state a
      // re-render after the previous save resets, so redo the whole sequence until the
      // old rows are gone from the UI, then wait for the save to land on disk too.
      const deleteAll = this.page.locator(this.TABPANEL).getByTestId("key-value-delete-all");
      await expect(async () => {
        await new PromptButtonComponent(this.page, deleteAll).clickAndConfirm();
        await expect(rows).toHaveCount(DEFAULT_ROWS.length + 1, { timeout: 3000 });
      }).toPass({ timeout: DEFAULT_TIMEOUT * 3 });
      await expect
        .poll(
          async () =>
            (await findDocs(this.page, this.dbFile)).some((doc) =>
              (doc.headers ?? []).some((h: any) => previous.some((p) => p.name === h.name && p.value === h.value)),
            ),
          { timeout: DEFAULT_TIMEOUT },
        )
        .toBe(false);
    }
    for (const [index, header] of headers.entries()) {
      const rowIndex = (await rows.count()) - 1;
      const row = rows.nth(rowIndex);
      if (header.name) {
        await this.keyValue.nameEditor(row).setValue(header.name);
        await this.waitForPersisted(headers.slice(0, index), header, false);
        // A persisted row is followed by a fresh blank one; typing the value
        // earlier lets that late re-render reset the value editor.
        await expect(rows).toHaveCount(rowIndex + 2, { timeout: DEFAULT_TIMEOUT });
      }
      await this.keyValue.valueEditor(row).setValue(header.value);
      if (header.disabled) {
        await row.locator('button[aria-pressed="true"]').click();
      }
      await this.waitForPersisted(headers.slice(0, index), header, true);
      if (!header.name) {
        await expect(rows).toHaveCount(rowIndex + 2, { timeout: DEFAULT_TIMEOUT });
      }
    }
    await this.waitForPersisted([], undefined, true, headers);
  }

  /**
   * Polls the persisted documents until one holds every earlier header plus
   * `current` (value only compared when `checkValue`), or, with `all`, until
   * one holds exactly those headers.
   */
  private async waitForPersisted(
    earlier: KeyValueRow[],
    current: KeyValueRow | undefined,
    checkValue: boolean,
    all?: KeyValueRow[],
  ): Promise<void> {
    const wanted = all ?? [...earlier, ...(current ? [current] : [])];
    const matches = (list: any[], header: KeyValueRow, withValue: boolean) =>
      list.some(
        (h) =>
          h.name === header.name &&
          (!withValue || ((h.value ?? "") === header.value && Boolean(h.disabled) === Boolean(header.disabled))),
      );
    await expect
      .poll(
        async () => {
          const docs = await findDocs(this.page, this.dbFile);
          return docs.some((doc) => {
            const list = doc.headers ?? [];
            return wanted.every((header, i) => matches(list, header, Boolean(all) || i < earlier.length || checkValue));
          });
        },
        { timeout: DEFAULT_TIMEOUT * 2, intervals: [250, 500] },
      )
      .toBe(true);
  }
}
