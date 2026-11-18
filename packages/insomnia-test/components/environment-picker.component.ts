import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * The environment picker (`environment-picker.tsx`) in the workspace header.
 * `root` is the header/pane containing the trigger button. Handles both
 * variants: "Project Environment" (global) and "API Collection Environment".
 */
export class EnvironmentPickerComponent extends BaseComponent {
  private static readonly COLLECTION = "Select an API Collection Environment";
  private static readonly PROJECT = "Select a Project Environment";

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
}
