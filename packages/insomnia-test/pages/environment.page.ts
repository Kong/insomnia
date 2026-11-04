import { KeyValueEditorComponent } from "@package/components/key-value-editor.component";
import { DEFAULT_TIMEOUT, LONG_TIMEOUT, SHORT_TIMEOUT } from "@package/misc/constants";
import type {
  EnvironmentKvPairData} from "@package/models/environment";
import {
  EnvironmentKvPairDataType,
} from "@package/models/environment";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

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
  private readonly DELETE_ALL_BUTTON =
    '#pane-one button[aria-label="Delete All"]';
  private readonly EDITABLE_NAME =
    '[data-editable="true"][aria-label="Environment name"]';
  private readonly LISTBOX =
    '#pane-one [role="listbox"][aria-label="Environment Key Value Pair"]';
  private get keyValue(): KeyValueEditorComponent {
    return new KeyValueEditorComponent(this.page, this.page.locator("#pane-one"));
  }
  private readonly SIDEBAR = '[aria-label="Environments"]';
  private readonly PROJECT_ENVIRONMENT_TRIGGER =
    'button[aria-label="Select a Project Environment"]';
  // Formerly "Select a Collection Environment".

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
   * Looks up an environment's stable `data-key` identifier from its
   * sidebar row.
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
   */
  async getVariables(): Promise<EnvironmentKvPairData[]> {
    const listbox = this.page.locator(this.LISTBOX);
    const rows = listbox.locator('[role="option"]');
    const count = await rows.count();
    const variables: EnvironmentKvPairData[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const name = await this.keyValue.nameEditor(row).getValue();
      const value = await this.keyValue.valueEditor(row).getValue();
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
   * real key. Waiting here for the
   * key to settle (unchanged across consecutive reads) avoids grabbing
   * the soon-to-be-stale key and losing the row mid-rename.
   */
  async renameEnvironment(oldName: string, newName: string): Promise<void> {
    const row = this.page.locator(
      `${this.SIDEBAR} [role="row"][aria-label="${oldName}"]`,
    );
    let stableRow = row;
    const input = this.page.locator(
      `${this.SIDEBAR} [role="row"] input[name="name"][aria-label="Environment name"]`,
    );
    // Re-resolve the row's key on every attempt: right after a duplicate the
    // old row (original env's key) is briefly shown before being swapped out.
    await expect(async () => {
      const key = await this.waitForStableAttribute(row, "data-key", SHORT_TIMEOUT);
      stableRow = this.page.locator(`${this.SIDEBAR} [role="row"][data-key="${key}"]`);
      await stableRow.locator(this.EDITABLE_NAME).dblclick({ timeout: SHORT_TIMEOUT });
      await expect(input).toBeVisible({ timeout: SHORT_TIMEOUT });
    }).toPass({ timeout: LONG_TIMEOUT });
    await input.fill(newName);
    await input.press("Enter");
    await expect(stableRow).toHaveAttribute("aria-label", newName);
  }

  /**
   * Clicks the sidebar row matching the given environment name to select
   * it.
   */
  async selectEnvironment(name: string): Promise<void> {
    await this.page
      .locator(`${this.SIDEBAR} [role="row"][aria-label="${name}"]`)
      .click();
  }

  /**
   * Replaces the entire key/value pair list: deletes all existing rows,
   * then adds each of the given variables one at a time. New rows are
   * always appended last, so each iteration locates the freshly added
   * row by grabbing the current last row's `data-key` before filling it
   * in. Disables a row afterward if `enabled` is explicitly `false`.
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
      await this.keyValue.nameEditor(row).setValue(variable.name);
      await this.waitForVariablePersisted(variable, { checkValue: false });
      await this.keyValue.valueEditor(row).setValue(variable.value);
      await this.waitForVariablePersisted(variable);
      if (variable.type) {
        await this.setType(row, variable.type);
      }
      if (variable.enabled === false) {
        await row.getByRole("button", { name: "Disable Row" }).click();
      }
    }
  }

  /**
   * Polls the on-disk environment documents until one lists `variable` in
   * its key/value pairs, confirming the row's debounced save has landed
   * (and the row has settled onto its persisted key) before the next edit
   * builds on it. Skipped for a blank name, which the app never persists.
   */
  private async waitForVariablePersisted(
    variable: EnvironmentKvPairData,
    { checkValue = true }: { checkValue?: boolean } = {},
  ): Promise<void> {
    await this.waitForRowPersisted(
      ["insomnia.Environment.db"],
      (doc) => [doc.kvPairData],
      variable.name,
      checkValue ? (pair) => pair.value === variable.value : undefined,
    );
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
