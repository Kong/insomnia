import { AuthTabComponent } from "@package/components/auth-tab.component";
import { ScriptTabComponent } from "@package/components/script-tab.component";
import { TabPanelComponent } from "@package/components/tab-panel.component";

import { BasePage } from "./base.page";

const FOLDER_PANE = '[data-testid="folder-pane"]';

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
export class FolderPage extends BasePage {
  protected readonly PANE = FOLDER_PANE;

  // Getters, not fields: the components are bound to the current window, so
  // building them on access keeps them following `this.page`.
  protected get panel(): TabPanelComponent {
    return new TabPanelComponent(this.page, this.PANE);
  }

  /** The Auth tab component for this folder's own pane. */
  get auth(): AuthTabComponent {
    return new AuthTabComponent(this.page, this.PANE);
  }

  /** The Scripts tab component for this folder's own pane. */
  get scripts(): ScriptTabComponent {
    return new ScriptTabComponent(this.page, this.PANE);
  }

  /**
   * Waits for this folder's pane to become visible, confirming it's open
   * and active.
   */
  async navigate(): Promise<void> {
    await this.panel.waitUntilVisible();
  }

  protected async switchTab(tab: string): Promise<void> {
    await this.panel.switchTab(tab);
  }

  /**
   * Opens the folder's Environment tab and adds each variable as a row in
   * its key/value table, confirming every name and value against the
   * folder's on-disk document before moving on to the next row.
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
}
