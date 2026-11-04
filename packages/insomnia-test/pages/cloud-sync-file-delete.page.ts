import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

/**
 * Deleting from the project dashboard: a file card's delete button and the
 * "Delete file" dialog, plus the sidebar delete-workspace dialog.
 */
export class CloudSyncFileDeletePage extends BasePage {
  /**
   * Waits for the project dashboard's file grid to be visible.
   */
  async navigate(): Promise<void> {
    await expect(this.page.getByTestId("workspace-grid")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
