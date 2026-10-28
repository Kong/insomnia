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
   * @param snippet - A substring of the tag's `data-template`
   * @param expectedPreview - The Live Preview value to wait for
   * @returns The modal's source text and settled preview
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
   * @param snippet - A substring of the tag's `data-template`
   * @param expectedPreview - The Live Preview value to wait for
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
   * @param snippet - A substring of the tag's `data-template`
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
   * @param snippet - A substring of the tag's `data-template`
   * @returns The tooltip text and the tag's own (short) display text
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
   * @param snippet - A substring of the tag's `data-template`
   * @param scope - Where the tag lives; defaults to the Manage Environments modal
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
   * @param snippet - A substring of the tag's `data-template`
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
   * @param first - Snippet of the first tag to hover
   * @param firstExpected - Text the tooltip must contain for the first tag
   * @param second - Snippet of the second tag to hover
   * @param secondExpected - Text the tooltip must contain for the second tag
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
   * @param option - The option value or `{ label }`
   * @param expectedPreview - The Live Preview value to wait for afterwards
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
   * @param template - The raw template text
   * @param expectedPreview - The Live Preview value to wait for afterwards
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
   * @param collection - The collection to link the project environment to
   * @param optionName - The project environment's name in the picker
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
   * @param name - The environment row's accessible name
   */
  async selectModalEnvironment(name: string): Promise<void> {
    await this.pageManager.variableSourcePage.selectModalEnvironment(name);
  }

  /**
   * Reads where an "Open" action landed.
   * @param landing - Which source surface the Open action should have opened
   * @param environmentRow - The environment row expected to be selected, when the surface has an Environments grid
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
