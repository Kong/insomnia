import type { ElectronApplication } from "@playwright/test";
import type { Page } from "playwright-core";

import { AuthTabComponent } from "./auth-tab.page";
import { ScriptTabComponent } from "./script-tab.page";
import { TabPanelPage } from "./tab-panel.page";

const FOLDER_PANE = 'div:has(> [aria-label="Request pane tabs"])';

/**
 * A Collection folder's own editor tab (Auth/Headers/Scripts/Environment/
 * Docs), opened via its "Open in New Tab" context-menu item — not to be
 * confused with the "Folder Settings" dialog its "Settings" item opens,
 * which only has a Name field and a Move/Copy-to-workspace control.
 *
 * Renders the exact same tab-bar component as a request's own pane, just
 * without the wrapping `data-testid="request-pane"` a request's pane
 * carries — scoped instead via the tab bar's `aria-label`, which is
 * unique to whichever tab is currently active.
 */
export class FolderPage extends TabPanelPage {
  /** The Auth tab component for this folder's own pane. */
  readonly auth: AuthTabComponent;

  /** The Scripts tab component for this folder's own pane. */
  readonly scripts: ScriptTabComponent;

  constructor(page: Page, insomnia?: ElectronApplication) {
    super(page, FOLDER_PANE, insomnia);
    this.auth = new AuthTabComponent(page, FOLDER_PANE, insomnia);
    this.scripts = new ScriptTabComponent(page, FOLDER_PANE, insomnia);
  }

  /**
   * Opens the folder's Environment tab and adds each variable as a row in
   * its key/value table, confirming every name and value against the
   * folder's on-disk document before moving on to the next row.
   * @param variables - The folder environment's variable names and values
   */
  async setEnvironmentVariables(variables: Record<string, string>): Promise<void> {
    await this.switchTab("environment");
    const listbox = this.page.locator(this.PANE).getByRole("listbox");
    for (const [name, value] of Object.entries(variables)) {
      const key = await listbox.locator('[role="option"]').last().getAttribute("data-key");
      const row = listbox.locator(`[role="option"][data-key="${key}"]`);
      await this.setCodeMirrorValue(
        row.getByTestId("OneLineEditor").nth(0).locator(".CodeMirror"),
        name,
      );
      await this.waitForRowPersisted(["insomnia.RequestGroup.db"], (doc) => [doc.kvPairData], name);
      await this.setCodeMirrorValue(
        row.getByTestId("OneLineEditor").nth(1).locator(".CodeMirror"),
        value,
      );
      await this.waitForRowPersisted(
        ["insomnia.RequestGroup.db"],
        (doc) => [doc.kvPairData],
        name,
        (pair) => pair.value === value,
      );
    }
  }

  /**
   * Also rewires the composed Auth/Scripts tab components, whose
   * persistence checks read the app's on-disk store via `insomnia`.
   * @param page - The freshly-launched app's main window
   * @param insomnia - The freshly-launched ElectronApplication, if any
   */
  override setContext(page: Page, insomnia?: ElectronApplication): void {
    super.setContext(page, insomnia);
    this.auth.setContext(page, insomnia);
    this.scripts.setContext(page, insomnia);
  }
}
