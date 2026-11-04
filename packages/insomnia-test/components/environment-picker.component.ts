import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * The environment picker (`environment-picker.tsx`) in the workspace header.
 * `root` is the header/pane containing the trigger button. Handles both
 * variants: "Project Environment" (global) and "API Collection Environment".
 */
export class EnvironmentPickerComponent extends BaseComponent {
  private static readonly COLLECTION = "Select an API Collection Environment";
  private static readonly PROJECT = "Select a Project Environment";

  trigger(kind: "collection" | "project" = "collection"): Locator {
    const label =
      kind === "project"
        ? EnvironmentPickerComponent.PROJECT
        : EnvironmentPickerComponent.COLLECTION;
    return this.root.getByRole("button", { name: label });
  }

  /**
   * The picker's popover `ListBox`, located by its label. The pickers are
   * `DialogTrigger`/`Popover` widgets, not react-aria `Select`s.
   */
  listbox(kind: "collection" | "project" = "collection"): Locator {
    const label =
      kind === "project"
        ? EnvironmentPickerComponent.PROJECT
        : EnvironmentPickerComponent.COLLECTION;
    return this.page.getByRole("listbox", { name: label });
  }

  async open(kind: "collection" | "project" = "collection"): Promise<void> {
    const listbox = this.listbox(kind);
    await expect(async () => {
      if (!(await listbox.isVisible())) await this.trigger(kind).click();
      await expect(listbox).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /** Opens the picker and picks the option whose label matches `name`. */
  async choose(
    name: string | RegExp,
    kind: "collection" | "project" = "collection",
  ): Promise<void> {
    await this.open(kind);
    const listbox = this.listbox(kind);
    await listbox
      .getByRole("option", typeof name === "string" ? { name, exact: true } : { name })
      .dispatchEvent("click");
    await expect(listbox).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  async current(kind: "collection" | "project" = "collection"): Promise<string> {
    return (await this.trigger(kind).innerText()).trim();
  }

  /** Opens "Manage API collection environments". */
  async manage(): Promise<void> {
    await this.open("collection");
    await this.page
      .getByRole("button", { name: "Manage API collection environments" })
      .click();
  }

  async editProjectEnvironment(name: string): Promise<void> {
    await this.open("project");
    await this.page.getByRole("button", { name: `Edit ${name}` }).click();
  }

  async addProjectEnvironment(): Promise<void> {
    await this.open("project");
    await this.page
      .getByRole("button", { name: "Add Project Environment" })
      .click();
  }
}
