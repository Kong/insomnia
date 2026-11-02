import type { Locator } from "@playwright/test";

import { BaseComponent } from "./base.component";
import { CodeEditorComponent } from "./code-editor.component";
import { KeyValueEditorComponent } from "./key-value-editor.component";
import { SelectComponent } from "./select.component";

/**
 * The request body tab (`editors/body/*`): the "Change Body Type" select
 * plus whichever editor that type renders (raw/JSON/XML → CodeEditor,
 * form/url-encoded → KeyValueEditor, file → "Choose File" button).
 * `root` is the tab panel.
 */
export class BodyEditorComponent extends BaseComponent {
  get typeSelect(): SelectComponent {
    return new SelectComponent(
      this.page,
      this.root.locator('button[aria-label="Change Body Type"]'),
    );
  }

  get codeEditor(): CodeEditorComponent {
    return new CodeEditorComponent(this.page, this.root.locator(".CodeMirror").first().locator("xpath=.."));
  }

  get formEditor(): KeyValueEditorComponent {
    return new KeyValueEditorComponent(this.page, this.root);
  }

  get chooseFileButton(): Locator {
    return this.root.getByRole("button", { name: "Choose File" });
  }

  async selectType(contentType: string): Promise<void> {
    await this.typeSelect.select(contentType);
  }

  async currentType(): Promise<string> {
    return this.typeSelect.nativeValue(this.root);
  }

  /** Writes `content` when the current body type has a text editor. */
  async setContent(content: string): Promise<void> {
    if ((await this.root.locator(".CodeMirror").count()) === 0) return;
    await this.codeEditor.setValue(content);
  }

  async getContent(): Promise<string> {
    return this.codeEditor.getValue();
  }
}
