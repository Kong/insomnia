import type { Locator, Page } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { OneLineEditorComponent } from "./code-editor.component";
import { DropdownComponent } from "./dropdown.component";

/**
 * The request URL bar (`request-url-bar.tsx`): method dropdown, URL editor,
 * Send button and the "Request Options" dropdown. `root` is the pane that
 * contains the bar (e.g. `[data-testid="request-pane"]`).
 */
export class RequestUrlBarComponent extends BaseComponent {
  get methodDropdown(): DropdownComponent {
    return new DropdownComponent(
      this.page,
      this.root.getByRole("button", { name: "Request Method" }),
    );
  }

  get urlEditor(): OneLineEditorComponent {
    return new OneLineEditorComponent(
      this.page,
      this.root.getByTestId("OneLineEditor").first(),
    );
  }

  get sendButton(): Locator {
    return this.root.getByRole("button", { name: "Send", exact: true });
  }

  get optionsDropdown(): DropdownComponent {
    return new DropdownComponent(
      this.page,
      this.root.getByRole("button", { name: "Request Options" }),
    );
  }

  async setMethod(method: string): Promise<void> {
    await this.methodDropdown.select(method);
  }

  async currentMethod(): Promise<string> {
    return (await this.methodDropdown.root.innerText()).trim();
  }

  async setUrl(url: string): Promise<void> {
    await this.urlEditor.setValue(url);
  }

  async getUrl(): Promise<string> {
    return this.urlEditor.getValue();
  }

  async send(): Promise<void> {
    await this.sendButton.click();
  }

  /** Picks an entry from the "Request Options" menu (e.g. "Generate Client Code"). */
  async chooseOption(name: string | RegExp): Promise<void> {
    await this.optionsDropdown.select(name);
  }
}
