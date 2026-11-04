import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * A CodeMirror-backed editor (`.client/codemirror/code-editor.tsx` or
 * `one-line-editor.tsx`). `root` is the editor container
 * (`data-testid="CodeEditor"` / `"OneLineEditor"`) or anything that
 * contains exactly one `.CodeMirror`.
 *
 * Reads and writes go through the editor's own `CodeMirror` instance API
 * instead of keystrokes, which is both faster and immune to autocomplete.
 */
export class CodeEditorComponent extends BaseComponent {
  private directCodeMirror?: Locator;

  /**
   * Wraps a locator that already points at the `.CodeMirror` element
   * itself (rather than a container holding one).
   */
  static fromCodeMirror(page: Page, codeMirror: Locator): CodeEditorComponent {
    const editor = new CodeEditorComponent(page, codeMirror);
    editor.directCodeMirror = codeMirror;
    return editor;
  }

  get codeMirror(): Locator {
    return this.directCodeMirror ?? this.root.locator(".CodeMirror").first();
  }

  async getValue(): Promise<string> {
    return this.codeMirror.evaluate(
      (el) => (el as any).CodeMirror?.getValue() ?? "",
    );
  }

  /**
   * Sets the value and confirms it holds for 200ms, retrying the whole
   * write if a background re-render (e.g. a `{{ }}` tag widget redraw or a
   * still-initializing document patch) reverts it.
   */
  async setValue(text: string): Promise<void> {
    const deadline = Date.now() + DEFAULT_TIMEOUT;
    let attempt = 0;
    do {
      attempt++;
      await expect(async () => {
        await this.codeMirror.evaluate(
          (el, value) => (el as any).CodeMirror?.setValue(value),
          text,
        );
        expect(await this.getValue()).toBe(text);
      }).toPass({ timeout: DEFAULT_TIMEOUT });
      if (await this.valueHolds(text, 200)) return;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.min(250 * attempt, 1000)),
      );
    } while (Date.now() < deadline);
    throw new Error(
      `CodeMirror value "${text}" did not hold after ${attempt} attempts`,
    );
  }

  private async valueHolds(
    expected: string,
    durationMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + durationMs;
    while (Date.now() < deadline) {
      if ((await this.getValue()) !== expected) return false;
      await this.waitForRendererIdle();
    }
    return true;
  }

  /** Types through the keyboard; use only when the key events matter. */
  async type(text: string): Promise<void> {
    await this.codeMirror.click();
    await this.page.keyboard.type(text);
  }
}

/** Single-line variant (`data-testid="OneLineEditor"`): url bar, kv cells. */
export class OneLineEditorComponent extends CodeEditorComponent {
}
