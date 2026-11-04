import type { Page } from "playwright-core";

import { AuthTabComponent } from "./auth-tab.page";
import { ScriptTabComponent } from "./script-tab.page";
import { TabPanelPage } from "./tab-panel.page";

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
export class FolderPage extends TabPanelPage {
  /** The Auth tab component for this folder's own pane. */
  readonly auth: AuthTabComponent;

  /** The Scripts tab component for this folder's own pane. */
  readonly scripts: ScriptTabComponent;

  constructor(page: Page) {
    super(page, FOLDER_PANE);
    this.auth = new AuthTabComponent(page, FOLDER_PANE);
    this.scripts = new ScriptTabComponent(page, FOLDER_PANE);
  }


  /**
   * Also rewires the composed Auth/Scripts tab components onto the new
   * window.
   */
  override setContext(page: Page): void {
    super.setContext(page);
    this.auth.setContext(page);
    this.scripts.setContext(page);
  }
}
