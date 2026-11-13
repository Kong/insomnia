import { AuthTabComponent } from "@package/components/auth-tab.component";
import { DocsTabComponent } from "@package/components/docs-tab.component";
import { HeadersTabComponent } from "@package/components/headers-tab.component";
import { ScriptTabComponent } from "@package/components/script-tab.component";
import { TabPanelComponent } from "@package/components/tab-panel.component";
import { WorkspaceEnvironmentsComponent } from "@package/components/workspace-environments.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BasePage } from "./base.page";

const COLLECTION_PANE = '[data-testid="collection-tab"]';
const WORKSPACE_DB = "insomnia.Workspace.db";

/**
 * A collection's own tab bar — Spec | [Tests] | Auth | Headers | Scripts |
 * Environment | Docs — and the panels of the collection-level properties.
 * It renders the same tab-bar component as a request's or a folder's pane,
 * scoped here by `data-testid="collection-tab"`.
 */
export class CollectionPage extends BasePage {
  protected readonly PANE = COLLECTION_PANE;

  protected get panel(): TabPanelComponent {
    return new TabPanelComponent(this.page, this.PANE);
  }

  get auth(): AuthTabComponent {
    return new AuthTabComponent(this.page, this.PANE);
  }

  get headers(): HeadersTabComponent {
    return new HeadersTabComponent(this.page, this.PANE, WORKSPACE_DB);
  }

  get scripts(): ScriptTabComponent {
    return new ScriptTabComponent(this.page, this.PANE);
  }

  get docs(): DocsTabComponent {
    return new DocsTabComponent(this.page, this.PANE, WORKSPACE_DB);
  }

  /** The Environment tab's editor (base + sub-environments, edited in place). */
  get environment(): WorkspaceEnvironmentsComponent {
    return new WorkspaceEnvironmentsComponent(this.page, this.page.locator(this.PANE));
  }

  /** Waits for the collection's tab bar to be visible. */
  async navigate(): Promise<void> {
    await this.panel.waitUntilVisible();
  }

  async switchTab(tab: string): Promise<void> {
    await this.panel.switchTab(tab);
  }

  /** The visible tab labels, left to right (without their indicators). */
  async getTabNames(): Promise<string[]> {
    return this.page
      .locator(`${this.PANE} [aria-label="API Collection Tabs"] [role="tab"]`)
      .evaluateAll((tabs) => tabs.map((tab) => (tab.firstElementChild ?? tab).textContent?.trim() ?? ""));
  }

  private tab(key: string): Locator {
    return this.panel.tabs.tab(key);
  }

  /** Whether the tab shows its green "has a value" dot (Auth, Scripts). */
  async hasActiveDot(tab: "auth" | "scripts"): Promise<boolean> {
    return this.tab(tab).getByTestId("tab-active-dot").isVisible();
  }

  /** The Headers tab's count badge: the number of enabled headers, 0 when it is not shown. */
  async getHeadersBadge(): Promise<number> {
    const badge = this.tab("headers").getByTestId("tab-count-badge");
    if (!(await badge.isVisible())) return 0;
    return Number((await badge.innerText()).trim());
  }

  /** Polls until the indicator state settles on `expected` (the tab re-renders after each save). */
  async expectIndicators(expected: { auth: boolean; headers: number; scripts: boolean }): Promise<void> {
    await expect
      .poll(
        async () => ({
          auth: await this.hasActiveDot("auth"),
          headers: await this.getHeadersBadge(),
          scripts: await this.hasActiveDot("scripts"),
        }),
        { timeout: DEFAULT_TIMEOUT },
      )
      .toEqual(expected);
  }

  private get environmentModal(): Locator {
    return this.page.getByRole("dialog").filter({ hasText: "Manage Environments" });
  }

  /**
   * Opens the "Manage Environments" modal through the environment dropdown
   * ("Select an API Collection Environment" -> "Manage API collection
   * environments") and returns the editor inside it.
   */
  async openEnvironmentModal(): Promise<WorkspaceEnvironmentsComponent> {
    await this.page.getByRole("button", { name: "Select an API Collection Environment" }).click();
    await this.page.getByRole("button", { name: "Manage API collection environments" }).click();
    await expect(this.environmentModal).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return new WorkspaceEnvironmentsComponent(this.page, this.environmentModal);
  }

  async closeEnvironmentModal(): Promise<void> {
    await this.environmentModal.getByRole("button", { name: "Close", exact: true }).click();
    await expect(this.environmentModal).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    // The environment dropdown's popover stays open behind the modal and keeps the page inert.
    const picker = this.page.getByRole("dialog", { name: "Select an API Collection Environment" });
    if (await picker.isVisible()) {
      await this.page.keyboard.press("Escape");
      await expect(picker).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    }
  }
}
