import { Page } from "playwright-core";
import { expect, Locator, type ElectronApplication } from "@playwright/test";

export abstract class BasePage {
  constructor(
    protected page: Page,
    protected insomnia?: ElectronApplication,
  ) {}

  /**
   * Navigates to this page and waits until it is confirmed ready for
   * interaction. Each subclass implements this to wait on a
   * page-specific visible element that indicates the page has loaded.
   */
  abstract navigate(): Promise<void>;

  /**
   * Rewires this Page instance onto a fresh window/ElectronApplication —
   * called by `PageManager.setWindow()` after `AppFlow.restart()`.
   * @param page - The freshly-launched app's main window
   * @param insomnia - The freshly-launched ElectronApplication, if any
   */
  setContext(page: Page, insomnia?: ElectronApplication): void {
    this.page = page;
    this.insomnia = insomnia;
  }

  /**
   * Reads a CodeMirror editor's current value directly via its own
   * `CodeMirror` instance API rather than scraping rendered DOM text.
   * @param locator - Must resolve to the `.CodeMirror` element itself (the one carrying the `CodeMirror` instance), not a wrapper around it
   * @returns The editor's current text value, or an empty string if no `CodeMirror` instance is attached
   */
  protected async readCodeMirror(locator: Locator): Promise<string> {
    return locator.evaluate((el) => (el as any).CodeMirror?.getValue() ?? "");
  }

  /**
   * Polls `locator`'s `attribute` until it reads the same value on two
   * consecutive checks, then returns it. Guards against a locator that's
   * about to be swapped out from under a caller — e.g. a list row that
   * briefly renders with a provisional key before the app's data refetch
   * settles it onto the persisted document's real one — by not returning
   * a value until it's stopped changing.
   * @param locator - The element whose attribute should settle
   * @param attribute - The attribute to poll
   * @param timeout - Overall budget to wait for the value to settle
   * @returns The settled attribute value
   */
  protected async waitForStableAttribute(
    locator: Locator,
    attribute: string,
    timeout = 5000,
  ): Promise<string | null> {
    const deadline = Date.now() + timeout;
    let previous = await locator.getAttribute(attribute);
    while (Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      const current = await locator.getAttribute(attribute);
      if (current === previous) return current;
      previous = current;
    }
    return previous;
  }

  /**
   * Sets a CodeMirror editor's value directly via its own `setValue()` API
   * instead of simulating keystrokes, re-reads it back to catch a stray
   * race that left it with the wrong content, then watches it for 200ms
   * to confirm the value actually holds — the immediate read-back only
   * confirms the write landed at that instant, but a background re-render
   * (e.g. a `{{ }}`/`{% %}` tag's inline widget redrawing) can silently
   * revert it shortly after, which a caller that immediately re-navigates
   * can otherwise observe as the field having raced back to its old
   * value. Retries the whole write up to 3 times if a revert is caught
   * within that window.
   *
   * This only confirms the live editor value, not that it has been
   * persisted to disk — see e.g. `HttpRequestFlow`/`GrpcRequestFlow`'s
   * `waitForUrlPersisted()` for that separate, stricter check.
   * @param cmLocator - Must resolve to the `.CodeMirror` element itself (the one carrying the `CodeMirror` instance), not a wrapper around it
   * @param text - The value to set
   */
  protected async setCodeMirrorValue(
    cmLocator: Locator,
    text: string,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await expect(async () => {
        await cmLocator.evaluate(
          (el, value) => (el as any).CodeMirror?.setValue(value),
          text,
        );
        expect(await this.readCodeMirror(cmLocator)).toBe(text);
      }).toPass({ timeout: 10000 });
      if (await this.valueHolds(cmLocator, text, 200)) return;
    }
  }

  /**
   * Polls `locator`'s CodeMirror value every 50ms for `durationMs`,
   * bailing out as soon as it no longer matches `expected` (a revert).
   * @param locator - Must resolve to the `.CodeMirror` element itself
   * @param expected - The value that must hold for the full duration
   * @param durationMs - How long the value must hold to count as stable
   * @returns `true` if `expected` held for the whole duration, `false` if it reverted first
   */
  private async valueHolds(
    locator: Locator,
    expected: string,
    durationMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + durationMs;
    while (Date.now() < deadline) {
      if ((await this.readCodeMirror(locator)) !== expected) return false;
      await this.page.waitForTimeout(50);
    }
    return true;
  }

  /**
   * Stubs Electron's native file-picker dialog so a "Choose File" button
   * can be automated without an OS-level file chooser.
   * @param filePath - Absolute path the stubbed dialog should return
   */
  protected async stubFileChooser(filePath: string): Promise<void> {
    if (!this.insomnia) {
      throw new Error(
        "ElectronApplication not available — pass `insomnia` through PageManager to stub the file chooser",
      );
    }
    await this.insomnia.evaluate(({ dialog }, fp) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [fp],
      })) as typeof dialog.showOpenDialog;
    }, filePath);
  }

  /**
   * Stubs Electron's native file-save dialog so an export action that
   * writes a single file can be automated without an OS-level save
   * prompt.
   * @param filePath - Absolute path the stubbed dialog should return
   */
  protected async stubSaveDialog(filePath: string): Promise<void> {
    if (!this.insomnia) {
      throw new Error(
        "ElectronApplication not available — pass `insomnia` through PageManager to stub the save dialog",
      );
    }
    await this.insomnia.evaluate(({ dialog }, fp) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: fp,
      })) as typeof dialog.showSaveDialog;
    }, filePath);
  }

  /**
   * Sends the platform's Undo shortcut (Cmd+Z on macOS, Ctrl+Z elsewhere)
   * to whatever currently has focus.
   * @param focus - Optional callback to click/focus the target editor
   * before sending the shortcut. Omit if the caller already focused it.
   */
  async undo(focus?: () => Promise<void>): Promise<void> {
    if (focus) {
      await focus();
    }
    await this.page.keyboard.press(
      process.platform === "darwin" ? "Meta+z" : "Control+z",
    );
  }

  /**
   * Checks whether an element is hidden. Pass one of a page's own public
   * readonly Locator fields, e.g. `projectSettingsPage.isHidden(projectSettingsPage.gitSetupForm)`.
   * @param target - The element to check
   * @returns Whether the element is hidden
   */
  async isHidden(target: Locator): Promise<boolean> {
    return target.isHidden();
  }

  /**
   * Checks whether an element is disabled. Pass one of a page's own public
   * readonly Locator fields, e.g. `projectSettingsPage.isDisabled(projectSettingsPage.scanForFilesButton)`.
   * @param target - The element to check
   * @returns Whether the element is disabled
   */
  async isDisabled(target: Locator): Promise<boolean> {
    return target.isDisabled();
  }

  /**
   * Checks whether a CodeMirror editor currently has focus, via the
   * `data-focused` attribute the app itself sets on the editor's
   * container on focus/blur (see one-line-editor.tsx) — more reliable
   * than comparing against `document.activeElement` across an iframe/
   * Electron boundary.
   * @param container - The editor's container element (the CodeMirror instance's textarea's parent), not the `.CodeMirror` element itself
   * @returns Whether the editor is currently focused
   */
  async hasFocus(container: Locator): Promise<boolean> {
    return (await container.getAttribute("data-focused")) === "on";
  }

  /**
   * Checks whether a plain DOM element (a button, a react-aria textbox,
   * a tab, etc. — anything that isn't a CodeMirror editor) currently has
   * focus, via `document.activeElement`. Use hasFocus() instead for a
   * CodeMirror editor's container, since CodeMirror doesn't reliably
   * register itself as `document.activeElement`.
   * @param target - The element to check
   * @returns Whether the element is currently the focused element
   */
  async isFocused(target: Locator): Promise<boolean> {
    return target.evaluate((el) => el === document.activeElement);
  }
}
