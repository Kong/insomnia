import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { findDocs } from "@package/misc/db";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { KeyValueEditorComponent } from "./key-value-editor.component";

export interface EnvironmentVariable {
  name: string;
  value: string;
}

/**
 * `WorkspaceEnvironmentsEditor`: the base/sub-environment sidebar plus the
 * key/value table of the selected environment. It renders both in the
 * collection's Environment tab and in the "Manage Environments" modal, so
 * `root` is whichever of the two the caller scopes it to.
 */
export class WorkspaceEnvironmentsComponent extends BaseComponent {
  private get listbox(): Locator {
    return this.root.locator('[role="listbox"][aria-label="Environment Key Value Pair"]');
  }

  private get keyValue(): KeyValueEditorComponent {
    return new KeyValueEditorComponent(this.page, this.root);
  }

  private row(name: string): Locator {
    return this.root.locator(`[aria-label="Environments"] [role="row"][aria-label="${name}"]`);
  }

  async getEnvironmentNames(): Promise<string[]> {
    const rows = this.root.locator('[aria-label="Environments"] [role="row"]');
    // The editor renders after its tab/modal opens; the base environment is always listed.
    await expect(rows.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return rows.evaluateAll((rows) => rows.map((row) => row.getAttribute("aria-label") ?? ""));
  }

  async selectEnvironment(name: string): Promise<void> {
    await this.row(name).click();
    await expect(this.listbox).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /** Reads every non-blank row of the selected environment. */
  async getVariables(): Promise<EnvironmentVariable[]> {
    const rows = this.listbox.locator('[role="option"]');
    const variables: EnvironmentVariable[] = [];
    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      const name = await this.keyValue.nameEditor(row).getValue();
      const value = await this.keyValue.valueEditor(row).getValue();
      if (name || value) variables.push({ name, value });
    }
    return variables;
  }

  /** Sets the value of an existing variable of the selected environment. */
  async setVariableValue(name: string, value: string): Promise<void> {
    const rows = this.listbox.locator('[role="option"]');
    for (let i = 0; i < (await rows.count()); i++) {
      const row = rows.nth(i);
      if ((await this.keyValue.nameEditor(row).getValue()) !== name) continue;
      await this.keyValue.valueEditor(row).setValue(value);
      await this.waitForVariablePersisted(name, value);
      return;
    }
    throw new Error(`Variable "${name}" not found in the selected environment`);
  }

  private async waitForVariablePersisted(name: string, value: string): Promise<void> {
    await expect
      .poll(
        async () =>
          (await findDocs(this.page, "insomnia.Environment.db")).some((doc) =>
            (doc.kvPairData ?? []).some((pair: any) => pair.name === name && pair.value === value),
          ),
        { timeout: DEFAULT_TIMEOUT },
      )
      .toBe(true);
  }
}
