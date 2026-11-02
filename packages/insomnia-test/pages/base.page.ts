import type { Locator } from "@playwright/test";
import { type ElectronApplication,expect } from "@playwright/test";
import type { Page } from "playwright-core";

import { CodeEditorComponent } from "../components/code-editor.component";
import { DEFAULT_TIMEOUT } from "../misc/constants";
import { latestLiveDocs, readNedbLines } from "../misc/nedb";
import { waitForRendererIdle, waitForStableValue } from "../misc/wait";

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
   */
  setContext(page: Page, insomnia?: ElectronApplication): void {
    this.page = page;
    this.insomnia = insomnia;
  }

  /**
   * Reads a CodeMirror editor's current value. See `CodeEditorComponent`.
   */
  protected async readCodeMirror(locator: Locator): Promise<string> {
    return CodeEditorComponent.fromCodeMirror(this.page, locator).getValue();
  }

  /**
   * Polls `locator`'s `attribute` until it reads the same value on two
   * consecutive checks, then returns it. Guards against a locator that's
   * about to be swapped out from under a caller — e.g. a list row that
   * briefly renders with a provisional key before the app's data refetch
   * settles it onto the persisted document's real one — by not returning
   * a value until it's stopped changing.
   */
  protected async waitForStableAttribute(
    locator: Locator,
    attribute: string,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<string | null> {
    return this.waitForStableValue(
      () => locator.getAttribute(attribute),
      2,
      timeout,
    );
  }

  /**
   * Sets a CodeMirror editor's value and confirms it holds. See
   * `CodeEditorComponent.setValue`.
   */
  protected async setCodeMirrorValue(
    cmLocator: Locator,
    text: string,
  ): Promise<void> {
    await CodeEditorComponent.fromCodeMirror(this.page, cmLocator).setValue(
      text,
    );
  }

  protected async waitForRendererIdle(): Promise<void> {
    await waitForRendererIdle(this.page);
  }

  /**
   * Reads the app's on-disk NeDB file `dbFile`, keeping only each
   * document's latest revision and dropping deleted ones.
   */
  protected async readPersistedDocs(dbFile: string): Promise<any[]> {
    const dataPath = await this.insomnia!.evaluate(({ app }) =>
      app.getPath("userData"),
    );
    return latestLiveDocs(readNedbLines(dataPath, dbFile));
  }

  /**
   * Polls the app's on-disk NeDB files until any live document in one of
   * `dbFiles` satisfies `predicate`. Use in place of a fixed sleep after
   * an edit the app saves through a debounce: the UI already shows the
   * new value, but a caller that navigates away or unmounts the editor
   * before the debounce fires can silently lose the write, and only the
   * on-disk store the app itself reads from shows it has landed.
   */
  protected async waitForPersisted(
    dbFiles: string[],
    predicate: (doc: any) => boolean,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<void> {
    await expect(async () => {
      let matched = false;
      for (const file of dbFiles) {
        if ((await this.readPersistedDocs(file)).some(predicate)) matched = true;
      }
      expect(matched).toBe(true);
    }).toPass({ timeout });
  }

  /**
   * Polls the on-disk NeDB files until any live document in one of
   * `dbFiles` holds `expected` at the value `read` extracts from it — the
   * single-field form of `waitForPersisted()`. Use after an edit the app
   * autosaves through a debounce (a script, an auth field, docs, a spec).
   */
  protected async waitForFieldPersisted(
    dbFiles: string[],
    read: (doc: any) => unknown,
    expected: unknown,
  ): Promise<void> {
    await this.waitForPersisted(dbFiles, (doc) => read(doc) === expected);
  }

  /**
   * Polls the on-disk NeDB files until any live document in one of
   * `dbFiles` lists a row named `name` in one of the arrays `rowsOf`
   * returns — confirming a name/value row's debounced save has landed
   * (and the row has settled onto its persisted key) before the next edit
   * builds on it. Skipped for a blank name, which the app never persists.
   */
  protected async waitForRowPersisted(
    dbFiles: string[],
    rowsOf: (doc: any) => unknown[],
    name: string,
    matchesValue?: (row: any) => boolean,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<void> {
    if (!name) return;
    await this.waitForPersisted(
      dbFiles,
      (doc) =>
        rowsOf(doc).some(
          (rows) =>
            Array.isArray(rows) &&
            rows.some(
              (row) => row.name === name && (matchesValue?.(row) ?? true),
            ),
        ),
      timeout,
    );
  }

  protected async waitForStableValue<T>(
    read: () => Promise<T>,
    stableReads?: number,
    timeout?: number,
  ): Promise<T> {
    return waitForStableValue(read, stableReads, timeout);
  }

  /**
   * Stubs Electron's native file-picker dialog so a "Choose File" button
   * can be automated without an OS-level file chooser.
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
   */
  async isHidden(target: Locator): Promise<boolean> {
    return target.isHidden();
  }

  /**
   * Checks whether an element is disabled. Pass one of a page's own public
   * readonly Locator fields, e.g. `projectSettingsPage.isDisabled(projectSettingsPage.scanForFilesButton)`.
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
   */
  async isFocused(target: Locator): Promise<boolean> {
    return target.evaluate((el) => el === document.activeElement);
  }
}
