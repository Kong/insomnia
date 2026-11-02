import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * The Git "History" modal. Opened from the Git Sync dropdown via
 * `GitSyncPage.openHistory()`.
 */
export class GitHistoryDialogPage extends BasePage {
  private readonly historyDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "History" }) });

  /**
   * Waits for the History modal to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.historyDialog).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reads the id (git OID, exposed via the row's `data-key` attribute) and
   * message of the most recent commit from the open History modal — the
   * log lists commits newest-first, and the first row after the column
   * header is that newest commit. Requires `openHistory()` to have been
   * called first.
   *
   * Matched by `[data-key]` rather than by row position: the table's
   * loading/empty placeholder is also a `role="row"` element (see
   * `openHistory()`), so `getByRole("row").nth(1)` can match that
   * placeholder — which carries no `data-key` — instead of the first real
   * commit row while the log is still being fetched. Only actual data rows
   * get a `data-key`, so waiting for one to appear here doubles as waiting
   * for the log to finish loading.
   */
  async getLatestCommit(): Promise<
    { id: string; message: string } | undefined
  > {
    const row = this.historyDialog.locator('[role="row"][data-key]').first();
    try {
      await expect(row).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    } catch {
      return undefined;
    }
    const id = await row.getAttribute("data-key");
    if (!id) return undefined;
    const message = await row.getByRole("rowheader").innerText();
    return { id, message };
  }

  /**
   * Closes the History modal via Escape.
   */
  async closeHistory(): Promise<void> {
    await this.page.keyboard.press("Escape");
    await expect(this.historyDialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }
}
