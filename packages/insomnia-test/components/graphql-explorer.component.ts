import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { DropdownComponent } from "./dropdown.component";
import { SearchFieldComponent } from "./search-field.component";

/**
 * GraphQL docs explorer (`graph-ql-explorer/*`) plus the toolbar dropdowns
 * from `editors/body/graph-ql-editor.tsx`. `root` is the GraphQL request pane.
 */
export class GraphQLExplorerComponent extends BaseComponent {
  get search(): SearchFieldComponent {
    return SearchFieldComponent.byPlaceholder(this.page, "Search the docs...");
  }

  get operationsDropdown(): DropdownComponent {
    return new DropdownComponent(
      this.page,
      this.root.getByRole("button", { name: "Operations Dropdown" }),
    );
  }

  get schemaDropdown(): DropdownComponent {
    return new DropdownComponent(
      this.page,
      this.root.getByRole("button", { name: "Schema Dropdown" }),
    );
  }

  async selectOperation(name: string): Promise<void> {
    await this.operationsDropdown.select(`Operation ${name}`);
  }

  async showDocumentation(): Promise<void> {
    await this.schemaDropdown.select("Show Documentation");
  }

  async refreshSchema(): Promise<void> {
    await this.schemaDropdown.select("Refresh Schema");
  }

  /** Type/field link in the explorer by visible text. */
  link(text: string | RegExp): Locator {
    return this.root
      .getByTestId("graphql-explorer")
      .locator(
        [
          "graphql-explorer-type-link",
          "graphql-explorer-field-link",
          "graphql-explorer-back",
          "graphql-explorer-close",
        ]
          .map((id) => `[data-testid="${id}"]`)
          .join(", "),
      )
      .filter({ hasText: text });
  }

  async navigateTo(text: string | RegExp): Promise<void> {
    await this.link(text).first().click();
  }
}
