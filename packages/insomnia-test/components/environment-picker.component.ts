import type { Locator, Page } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { SelectComponent } from "./select.component";

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

  select(kind: "collection" | "project" = "collection"): SelectComponent {
    return new SelectComponent(this.page, this.trigger(kind));
  }

  async choose(
    name: string | RegExp,
    kind: "collection" | "project" = "collection",
  ): Promise<void> {
    await this.select(kind).select(name);
  }

  async current(kind: "collection" | "project" = "collection"): Promise<string> {
    return (await this.trigger(kind).innerText()).trim();
  }

  /** Opens "Manage API collection environments". */
  async manage(): Promise<void> {
    await this.select("collection").open();
    await this.page
      .getByRole("button", { name: "Manage API collection environments" })
      .click();
  }

  async editProjectEnvironment(name: string): Promise<void> {
    await this.select("project").open();
    await this.page.getByRole("button", { name: `Edit ${name}` }).click();
  }

  async addProjectEnvironment(): Promise<void> {
    await this.select("project").open();
    await this.page
      .getByRole("button", { name: "Add Project Environment" })
      .click();
  }
}
