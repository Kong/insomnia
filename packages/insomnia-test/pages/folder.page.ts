import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { AuthTabPage } from "./auth-tab.page";

/**
 * A Collection folder's own editor tab (Auth/Headers/Scripts/Environment/
 * Docs), opened via its "Open in New Tab" context-menu item — not to be
 * confused with the "Folder Settings" dialog its "Settings" item opens,
 * which only has a Name field and a Move/Copy-to-workspace control.
 *
 * Renders the exact same Auth tab component as a request's own pane (see
 * `AuthTabPage`), just without the wrapping `data-testid="request-pane"`
 * a request's pane carries — scoped instead via the tab bar's
 * `aria-label`, which is unique to whichever tab is currently active.
 */
export class FolderPage extends AuthTabPage {
  protected readonly PANE = 'div:has(> [aria-label="Request pane tabs"])';

  /**
   * Waits for the folder's tab pane to become visible, confirming it's
   * open and active.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.PANE)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }
}
