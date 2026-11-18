import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { BaseComponent } from "./base.component";

/**
 * Monaco editors, which Insomnia only uses for lazily-created diff views
 * (git/cloud commit and visual-diff modals). `root` is the container; the
 * editor is created once its container is within ~300px of the viewport, so
 * `waitForEditor()` scrolls to it first.
 */
export class MonacoEditorComponent extends BaseComponent {
  get diffEditor(): Locator {
    return this.root.locator(".monaco-diff-editor").first();
  }

  async waitForEditor(): Promise<void> {
    await this.root.scrollIntoViewIfNeeded();
    await expect(this.diffEditor).toBeAttached({ timeout: DEFAULT_TIMEOUT });
    await this.diffEditor.scrollIntoViewIfNeeded();
    await expect(this.diffEditor).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  async hasDiffEditor(): Promise<boolean> {
    return (await this.root.locator(".monaco-diff-editor").count()) > 0;
  }

  async foldedRegionCount(): Promise<number> {
    return this.diffEditor.locator(".diff-hidden-lines").count();
  }

  /** Lines drawn on the modified (right) side. */
  async modifiedLineCount(): Promise<number> {
    return this.diffEditor.locator(".modified .view-line").count();
  }

  /** Rendered text of the currently drawn lines (virtualized). */
  async visibleText(): Promise<string> {
    return this.diffEditor.locator(".view-lines").first().innerText();
  }
}
