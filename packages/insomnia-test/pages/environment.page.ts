import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import type {
  EnvironmentKvPairData} from "../models/environment";
import {
  EnvironmentKvPairDataType,
} from "../models/environment";
import { BasePage } from "./base.page";

const TYPE_LABELS: Record<EnvironmentKvPairDataType, string> = {
  [EnvironmentKvPairDataType.JSON]: "JSON",
  [EnvironmentKvPairDataType.STRING]: "Text",
  [EnvironmentKvPairDataType.SECRET]: "Secret",
};
const LABEL_TYPES = Object.fromEntries(
  Object.entries(TYPE_LABELS).map(([type, label]) => [label, type]),
) as Record<string, EnvironmentKvPairDataType>;

export class EnvironmentPage extends BasePage {
  private readonly ADD_SUB_ENVIRONMENT_BUTTON =
    '[data-testid="AddSubEnvironment"]';
  private readonly ADD_PRIVATE_SUB_ENVIRONMENT_BUTTON =
    '[data-testid="AddPrivateSubEnvironment"]';
  private readonly DELETE_ALL_BUTTON =
    '#pane-one button[aria-label="Delete All"]';
  private readonly EDITABLE_NAME =
    '[data-editable="true"][aria-label="Environment name"]';
  private readonly LISTBOX =
    '#pane-one [role="listbox"][aria-label="Environment Key Value Pair"]';
  private readonly ONE_LINE_EDITOR = '[data-testid="OneLineEditor"]';
  private readonly RAW_EDIT_BUTTON = '#pane-one button[aria-label="Raw Edit"]';
  private readonly TABLE_EDIT_BUTTON =
    '#pane-one button[aria-label="Table Edit"]';
  private readonly RAW_EDITOR = ".environment-editor";
  private readonly SIDEBAR = '[aria-label="Environments"]';
  private readonly PROJECT_ENVIRONMENT_TRIGGER =
    'button[aria-label="Select a Project Environment"]';
  // Renamed from "Select a Collection Environment" — INS-3528.
  private readonly COLLECTION_ENVIRONMENT_TRIGGER =
    'button[aria-label="Select an API Collection Environment"]';

  /**
   * Creates a new shared or private sub-environment under the current
   * page's own Base Environment via the sidebar's always-visible "Add Sub
   * Environment"/"Add Private Sub Environment" button, then renames it
   * from its auto-generated default name to the requested one. Waits for
   * the sidebar row count to increase before assuming the new environment
   * exists. Only ever nests directly under Base Environment — the app has
   * no way to create a sub-environment nested under another sub-environment.
   * @param name - The name to give the newly created sub-environment
   * @param isPrivate - Whether to create a private environment instead of a shared one
   */
  async createSubEnvironment(
    name: string,
    isPrivate = false,
  ): Promise<void> {
    const rows = this.page.locator(`${this.SIDEBAR} [role="row"]`);
    const countBefore = await rows.count();

    const button = isPrivate
      ? this.ADD_PRIVATE_SUB_ENVIRONMENT_BUTTON
      : this.ADD_SUB_ENVIRONMENT_BUTTON;
    await this.page.locator(button).click();

    await expect(rows).toHaveCount(countBefore + 1, {
      timeout: DEFAULT_TIMEOUT,
    });
    const currentName = (await rows.last().getAttribute("aria-label")) ?? "";
    await this.renameEnvironment(currentName, name);
  }

  /**
   * Clicks "Delete All" to remove every key/value pair row, but only if
   * the button is enabled (it's disabled when the list is already
   * empty). It's a confirm button: the first click only arms it, the
   * second confirms and actually deletes.
   */
  private async deleteAll(): Promise<void> {
    const button = this.page.locator(this.DELETE_ALL_BUTTON);
    if (await button.isEnabled()) {
      await button.click();
      await button.click();
    }
  }

  /**
   * Deletes a single key/value pair row via its "Delete Row" button.
   * It's a confirm button: the first click only arms it, the second
   * confirms and actually deletes the row.
   * @param row - The row locator to delete
   */
  async deleteRow(row: Locator): Promise<void> {
    const button = row.getByRole("button", { name: "Delete Row" });
    await button.click();
    await button.click();
  }

  /**
   * Locates a committed key/value pair row by its current name, for
   * passing into `deleteRow()`. Only matches rows whose name/value text
   * contains the given name, so it never matches the always-present
   * trailing blank row.
   * @param name - The row's current name value
   * @returns A Locator for the matching row
   */
  getRow(name: string): Locator {
    return this.page
      .locator(this.LISTBOX)
      .locator('[role="option"]')
      .filter({ hasText: name });
  }

  /**
   * Looks up an environment's stable `data-key` identifier from its
   * sidebar row.
   * @param name - The environment's display name (matched via `aria-label`)
   * @returns The environment's `data-key`, or `undefined` if no row with that name exists
   */
  async getEnvironmentId(name: string): Promise<string | undefined> {
    const row = this.page.locator(
      `${this.SIDEBAR} [role="row"][aria-label="${name}"]`,
    );
    if ((await row.count()) === 0) return undefined;
    return (await row.getAttribute("data-key")) ?? undefined;
  }

  /**
   * Reads the names of every environment listed in the sidebar, in
   * display order.
   * @returns Each row's `aria-label` (empty string if a row has none)
   */
  async getEnvironmentNames(): Promise<string[]> {
    return this.page
      .locator(`${this.SIDEBAR} [role="row"]`)
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("aria-label") ?? ""),
      );
  }

  /**
   * Reads every key/value pair row currently shown in the listbox,
   * including its type and enabled/disabled state. Rows with both an
   * empty name and value are omitted.
   * @returns The variables currently displayed
   */
  async getVariables(): Promise<EnvironmentKvPairData[]> {
    const listbox = this.page.locator(this.LISTBOX);
    const rows = listbox.locator('[role="option"]');
    const count = await rows.count();
    const variables: EnvironmentKvPairData[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const name = await this.readCodeMirror(
        row.locator(this.ONE_LINE_EDITOR).nth(0).locator(".CodeMirror"),
      );
      const value = await this.readCodeMirror(
        row.locator(this.ONE_LINE_EDITOR).nth(1).locator(".CodeMirror"),
      );
      const type = await this.getType(row);
      const enabled =
        (await row.getByRole("button", { name: "Enable Row" }).count()) === 0;
      if (name || value) variables.push({ id: "", name, value, type, enabled });
    }
    return variables;
  }

  /**
   * Opens the "Select a Project Environment" popover and links this
   * workspace to a project-level environment (and, optionally, one of its
   * global sub-environments) before dismissing the popover. The picker
   * lists every project environment's base row followed by its own
   * sub-environments as one flattened list, so picking either is the same
   * single click — there's no separate container-then-sub-environment step
   * anymore. Passing `containerName` alone as "No Project Environment"
   * unlinks whichever project environment is currently linked, since that
   * sentinel is itself a normal row in the list.
   * @param containerName - The project environment's own (base) name to select
   * @param environmentName - The global sub-environment to select; defaults to "Base Environment", in which case `containerName` itself is selected instead
   */
  async linkProjectEnvironment(
    containerName: string,
    environmentName = "Base Environment",
  ): Promise<void> {
    const optionName =
      environmentName === "Base Environment" ? containerName : environmentName;
    const trigger = this.page.locator(this.PROJECT_ENVIRONMENT_TRIGGER);
    await trigger.click();
    const listbox = this.page.getByRole("listbox", {
      name: "Select a Project Environment",
    });
    await listbox.getByRole("option", { name: optionName }).click();
    await expect(trigger).toContainText(optionName);

    await this.page.keyboard.press("Escape");
    await listbox.waitFor({ state: "hidden", timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the "Select a Collection Environment" popover and activates one
   * of the current workspace's own built-in "Collection Environments" (its
   * Base Environment, or a private/shared sub-environment nested directly
   * under it — e.g. from an imported legacy-format collection) before
   * dismissing the popover. Distinct from `linkProjectEnvironment()`, which
   * instead links a separate Project Environment workspace — confirmed
   * live: both pickers operate independently, and selecting a Collection
   * Environment doesn't clear whichever Project Environment is already
   * linked; their variables merge into the same active render context.
   * @param name - The collection's own environment/sub-environment name to activate
   */
  async selectCollectionEnvironment(name: string): Promise<void> {
    const trigger = this.page.locator(this.COLLECTION_ENVIRONMENT_TRIGGER);
    await trigger.click();
    const listbox = this.page.getByRole("listbox", {
      name: "Select an API Collection Environment",
    });
    await listbox.getByRole("option", { name }).click();
    await expect(trigger).toContainText(name);

    await this.page.keyboard.press("Escape");
    await listbox.waitFor({ state: "hidden", timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Waits for the environment key/value pair listbox to become visible,
   * confirming the environment page is ready for interaction.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.LISTBOX)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Double-clicks an environment row's editable name to enter inline
   * rename mode, types the new name, and confirms with Enter. Re-locates
   * the row by its stable `data-key` (rather than the old `aria-label`)
   * so the rename can be verified after the label itself has changed.
   *
   * Right after a workspace-level operation (e.g. duplicating an
   * Environment), the row can briefly render with a provisional
   * `data-key` before the app's list swaps in the persisted document's
   * real key — confirmed live via a polling probe. Waiting here for the
   * key to settle (unchanged across consecutive reads) avoids grabbing
   * the soon-to-be-stale key and losing the row mid-rename.
   * @param oldName - The environment's current display name
   * @param newName - The name to rename it to
   */
  async renameEnvironment(oldName: string, newName: string): Promise<void> {
    const row = this.page.locator(
      `${this.SIDEBAR} [role="row"][aria-label="${oldName}"]`,
    );
    const key = await this.waitForStableAttribute(row, "data-key");
    const stableRow = this.page.locator(
      `${this.SIDEBAR} [role="row"][data-key="${key}"]`,
    );

    await row.locator(this.EDITABLE_NAME).dblclick();
    const input = stableRow.locator(
      'input[name="name"][aria-label="Environment name"]',
    );
    await input.fill(newName);
    await input.press("Enter");
    await expect(stableRow).toHaveAttribute("aria-label", newName);
  }

  /**
   * Clicks the sidebar row matching the given environment name to select
   * it.
   * @param name - The environment's display name (matched via `aria-label`)
   */
  async selectEnvironment(name: string): Promise<void> {
    await this.page
      .locator(`${this.SIDEBAR} [role="row"][aria-label="${name}"]`)
      .click();
  }

  /**
   * The key/value pair listbox's trailing (last) row's Name editor
   * container — the app sets a `data-focused` attribute on this element
   * on focus/blur, so pass this to BasePage's hasFocus() to check
   * whether that row's Name cell is focused. For a brand-new,
   * still-empty environment this trailing row is also its only row.
   */
  get blankRowNameContainer(): Locator {
    return this.page
      .locator(this.LISTBOX)
      .locator('[role="option"]')
      .last()
      .locator(".editor__container")
      .first();
  }

  /**
   * Replaces the entire key/value pair list: deletes all existing rows,
   * then adds each of the given variables one at a time. New rows are
   * always appended last, so each iteration locates the freshly added
   * row by grabbing the current last row's `data-key` before filling it
   * in. Disables a row afterward if `enabled` is explicitly `false`.
   * @param variables - The variables to set as the new complete list
   */
  async setVariables(variables: EnvironmentKvPairData[]): Promise<void> {
    await this.deleteAll();
    const listbox = this.page.locator(this.LISTBOX);
    for (const variable of variables) {
      const key = await listbox
        .locator('[role="option"]')
        .last()
        .getAttribute("data-key");
      const row = listbox.locator(`[role="option"][data-key="${key}"]`);
      await this.setCodeMirrorValue(
        row.locator(this.ONE_LINE_EDITOR).nth(0).locator(".CodeMirror"),
        variable.name,
      );
      await this.page.waitForTimeout(500);
      await this.setCodeMirrorValue(
        row.locator(this.ONE_LINE_EDITOR).nth(1).locator(".CodeMirror"),
        variable.value,
      );
      await this.page.waitForTimeout(500);
      if (variable.type) {
        await this.setType(row, variable.type);
      }
      if (variable.enabled === false) {
        await row.getByRole("button", { name: "Disable Row" }).click();
      }
    }
  }

  /**
   * Toggles the environment pane between its key/value row editor and
   * its raw (JSON) text editor view.
   */
  async toggleRawEdit(): Promise<void> {
    const button = this.page
      .locator(this.RAW_EDIT_BUTTON)
      .or(this.page.locator(this.TABLE_EDIT_BUTTON));
    await button.click();
  }

  /**
   * Reads the current environment's raw JSON text, once the raw editor
   * view is showing (see `toggleRawEdit()`).
   * @returns The raw JSON text currently in the editor
   */
  async getRawJson(): Promise<string> {
    return this.readCodeMirror(
      this.page.locator(`${this.RAW_EDITOR} .CodeMirror`),
    );
  }

  /**
   * Replaces the current environment's raw JSON text, once the raw
   * editor view is showing (see `toggleRawEdit()`).
   * @param json - The raw JSON text to set
   */
  async setRawJson(json: string): Promise<void> {
    await this.setCodeMirrorValue(
      this.page.locator(`${this.RAW_EDITOR} .CodeMirror`),
      json,
    );
    await this.page.waitForTimeout(1000);
  }

  private async getType(row: Locator): Promise<EnvironmentKvPairDataType> {
    const text = await row
      .locator('button[aria-label="Type Selection"]')
      .innerText();
    return LABEL_TYPES[text.trim()] ?? EnvironmentKvPairDataType.STRING;
  }

  private async setType(
    row: Locator,
    type: EnvironmentKvPairDataType,
  ): Promise<void> {
    await row.locator('button[aria-label="Type Selection"]').click();
    await this.page
      .getByRole("menuitemradio", { name: TYPE_LABELS[type] })
      .click();
  }
}
