import type { Collection } from "../models/collection";
import type {
  VariableSourceModal,
  VariableSourceScope,
} from "../pages/variable-source.page";
import { BaseFlow } from "./base.flow";

export type VariableSourceLanding = "environments-modal" | "environment-page" | "folder-pane";

export interface VariableSourceNavigation {
  url: string;
  selectedEnvironmentRow?: boolean;
  environmentTabSelected?: boolean;
  manageEnvironmentsModalCount: number;
}

export class VariableSourceFlow extends BaseFlow {
  /**
   * Opens the Body tab of the currently open request, clicks the template
   * tag matching `snippet` to open its editor modal, and reads its Source
   * row plus Live Preview once the preview settles on `expectedPreview`.
   */
  async inspectVariableModal(
    snippet: string,
    expectedPreview: string,
  ): Promise<VariableSourceModal> {
    const page = this.pageManager.variableSourcePage;
    await page.navigate();
    await page.openVariableModal(snippet);
    return page.waitForModalPreview(expectedPreview);
  }

  /**
   * Clicks the template tag matching `snippet` in the currently open
   * environment page's editor to open its tag editor modal, and reads its
   * Source row plus Live Preview once the preview settles.
   */
  async inspectEnvironmentPageVariable(
    snippet: string,
    expectedPreview: string,
  ): Promise<VariableSourceModal> {
    const page = this.pageManager.variableSourcePage;
    await page.openVariableModal(snippet);
    return page.waitForModalPreview(expectedPreview);
  }

  /**
   * Hovers the template tag matching `snippet` in the currently open
   * environment page's editor until its variable-source tooltip shows.
   */
  async hoverEnvironmentPageVariable(
    snippet: string,
  ): Promise<{ tooltip: string; chip: string }> {
    return this.pageManager.variableSourcePage.hoverVariable(snippet);
  }

  /**
   * Opens the Body tab of the currently open request and hovers the
   * template tag matching `snippet` until its variable-source tooltip
   * shows.
   */
  async hoverVariable(
    snippet: string,
  ): Promise<{ tooltip: string; chip: string }> {
    const page = this.pageManager.variableSourcePage;
    await page.navigate();
    return page.hoverVariable(snippet);
  }

  /**
   * Hovers the template tag matching `snippet` inside the open Manage
   * Environments modal until its variable-source tooltip shows.
   */
  async hoverVariableInModal(
    snippet: string,
    scope: VariableSourceScope = "modal",
  ): Promise<{ tooltip: string; chip: string }> {
    return this.pageManager.variableSourcePage.hoverVariable(snippet, scope);
  }

  /**
   * Hovers the tag matching `snippet` on the Body tab, then hovers the
   * tooltip's own content and reports whether it stayed visible.
   */
  async hoverTooltipContent(snippet: string): Promise<boolean> {
    const page = this.pageManager.variableSourcePage;
    await page.navigate();
    await page.hoverVariable(snippet);
    return page.isTooltipKeptOnHover();
  }

  /**
   * Hovers `first`'s tag then `second`'s tag on the Body tab, returning
   * the tooltip text after each hover (the tooltip swaps rather than
   * vanishing when the pointer moves between tags).
   */
  async hoverBetweenVariables(
    first: string,
    firstExpected: string,
    second: string,
    secondExpected: string,
  ): Promise<{ first: string; second: string }> {
    const page = this.pageManager.variableSourcePage;
    await page.navigate();
    const firstTooltip = await page.hoverVariableUntilTooltipContains(
      first,
      firstExpected,
    );
    const secondTooltip = await page.hoverVariableUntilTooltipContains(
      second,
      secondExpected,
    );
    return { first: firstTooltip, second: secondTooltip };
  }

  /**
   * Switches the open tag editor modal's selected variable.
   */
  async selectModalVariable(
    option: string | { label: string },
    expectedPreview?: string,
  ): Promise<VariableSourceModal> {
    const page = this.pageManager.variableSourcePage;
    await page.selectModalVariable(option);
    return expectedPreview === undefined
      ? page.readVariableModal()
      : page.waitForModalPreview(expectedPreview);
  }

  /**
   * Types a custom template into the open tag editor modal and reads the
   * re-derived Source row and Live Preview.
   */
  async setModalTemplate(
    template: string,
    expectedPreview?: string,
  ): Promise<VariableSourceModal> {
    const page = this.pageManager.variableSourcePage;
    await page.setModalCustomTemplate(template);
    return expectedPreview === undefined
      ? page.readVariableModal()
      : page.waitForModalPreview(expectedPreview);
  }

  /**
   * Clicks the open tag editor modal's Source "Open" button.
   */
  async openSourceFromModal(): Promise<void> {
    await this.pageManager.variableSourcePage.clickModalSourceOpen();
  }

  /**
   * Clicks the visible variable-source tooltip's "Open" button.
   */
  async openSourceFromTooltip(): Promise<void> {
    await this.pageManager.variableSourcePage.clickTooltipOpen();
  }

  /**
   * Opens `collection` and picks an imported project environment for it.
   */
  async selectProjectEnvironment(
    collection: Collection,
    optionName: string,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    await workspace.clickNode(await workspace.resolveNode(collection));
    await this.pageManager.variableSourcePage.selectProjectEnvironment(optionName);
  }

  /**
   * Opens the collection's Manage Environments modal.
   */
  async openManageEnvironmentsModal(): Promise<void> {
    await this.pageManager.variableSourcePage.openManageEnvironmentsModal();
  }

  /**
   * Selects an environment row inside the open Manage Environments modal.
   */
  async selectModalEnvironment(name: string): Promise<void> {
    await this.pageManager.variableSourcePage.selectModalEnvironment(name);
  }

  /**
   * Reads where an "Open" action landed.
   */
  async getNavigation(
    landing: VariableSourceLanding,
    environmentRow?: string,
  ): Promise<VariableSourceNavigation> {
    const page = this.pageManager.variableSourcePage;
    const urlPatterns: Record<VariableSourceLanding, RegExp> = {
      "environments-modal": /.*/,
      "environment-page": /\/environment\/?$/,
      "folder-pane": /debug\/request-group\//,
    };
    const navigation: VariableSourceNavigation = {
      url: await page.waitForUrl(urlPatterns[landing]),
      manageEnvironmentsModalCount:
        await page.getManageEnvironmentsModalCount(),
    };
    if (landing === "folder-pane") {
      navigation.environmentTabSelected = await page.isEnvironmentTabSelected();
    }
    if (environmentRow !== undefined) {
      navigation.selectedEnvironmentRow =
        await page.isEnvironmentRowSelected(environmentRow);
    }
    return navigation;
  }

  /**
   * Waits for the Manage Environments modal to close.
   */
  async waitForManageEnvironmentsModalClosed(): Promise<void> {
    await this.pageManager.variableSourcePage.waitForManageEnvironmentsModalHidden();
  }
}
