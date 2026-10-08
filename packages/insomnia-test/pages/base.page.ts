import * as fs from "node:fs";
import path from "node:path";

import type { Locator } from "@playwright/test";
import { type ElectronApplication,expect } from "@playwright/test";
import type { Page } from "playwright-core";

import { DEFAULT_TIMEOUT } from "../misc/constants";

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
    timeout = DEFAULT_TIMEOUT,
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
      }).toPass({ timeout: DEFAULT_TIMEOUT });
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
      await this.waitForRendererIdle();
    }
    return true;
  }

  /**
   * Waits for the page's own event loop to drain everything already
   * queued in it — every pending microtask (promise `.then()` chains),
   * then one full macrotask turn — before returning. Use right before an
   * action whose outcome depends on a React state update that a
   * just-confirmed async write (e.g. a fetcher action landing in NeDB)
   * triggers a moment *later* rather than synchronously, such as a
   * React Router loader revalidation. Because this round-trips through
   * the renderer's own task queue instead of guessing a duration from the
   * test process (`page.waitForTimeout()`), anything already scheduled
   * inside the page — including a slow revalidation stalled behind a busy
   * main thread under CI load — is guaranteed to have run by the time
   * this resolves, in a way a fixed sleep can't reliably promise.
   */
  protected async waitForRendererIdle(): Promise<void> {
    await this.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => setTimeout(resolve, 0), 0);
        }),
    );
  }

  /**
   * Reads the app's on-disk NeDB file `dbFile`, keeping only each
   * document's latest revision and dropping deleted ones.
   * @param dbFile - The NeDB filename to read, e.g. `"insomnia.ApiSpec.db"`
   * @returns The live documents currently persisted in that file
   */
  protected async readPersistedDocs(dbFile: string): Promise<any[]> {
    const dataPath = await this.insomnia!.evaluate(({ app }) =>
      app.getPath("userData"),
    );
    const latest = new Map<string, any>();
    for (const line of fs
      .readFileSync(path.join(dataPath, dbFile), "utf8")
      .split("\n")
      .filter(Boolean)) {
      const doc = JSON.parse(line);
      if (doc.$$deleted) latest.delete(doc._id);
      else latest.set(doc._id, doc);
    }
    return [...latest.values()];
  }

  /**
   * Polls the app's on-disk NeDB files until any live document in one of
   * `dbFiles` satisfies `predicate`. Use in place of a fixed sleep after
   * an edit the app saves through a debounce: the UI already shows the
   * new value, but a caller that navigates away or unmounts the editor
   * before the debounce fires can silently lose the write, and only the
   * on-disk store the app itself reads from shows it has landed.
   * @param dbFiles - The NeDB filenames to scan, e.g. `["insomnia.Request.db"]`
   * @param predicate - Receives each document's latest revision; return `true` when it holds the expected state
   * @param timeout - Overall budget to wait for a matching document
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
   * @param dbFiles - The NeDB filenames to scan, e.g. `["insomnia.Request.db"]`
   * @param read - Extracts the value under test from a document
   * @param expected - The value it must settle on
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
   * @param dbFiles - The NeDB filenames to scan
   * @param rowsOf - Returns the candidate row lists of a document (params, headers, kvPairData, ...)
   * @param name - The row name to look for
   * @param matchesValue - Optional extra check on the named row (its value/disabled state); omit to match on name alone
   * @param timeout - Overall budget to wait for the row to land
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

  /**
   * Polls `read` until it returns the same value (compared by JSON) on
   * consecutive reads — the poll-based replacement for sleeping while a
   * debounced/async re-render (a filtered list, a search result set, a
   * tree after a drop) settles.
   * @param read - Reads whatever should stop changing
   * @param stableReads - How many consecutive identical reads count as settled
   * @param timeout - Overall budget to wait for the value to settle
   * @returns The settled value
   */
  protected async waitForStableValue<T>(
    read: () => Promise<T>,
    stableReads = 3,
    timeout = DEFAULT_TIMEOUT,
  ): Promise<T> {
    let previous = "";
    let streak = 0;
    let value!: T;
    await expect(async () => {
      value = await read();
      const serialized = JSON.stringify(value);
      streak = serialized === previous ? streak + 1 : 1;
      previous = serialized;
      expect(streak).toBeGreaterThanOrEqual(stableReads);
    }).toPass({ timeout, intervals: [100] });
    return value;
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
