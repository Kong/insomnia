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
