import { CodeEditorComponent } from "@package/components/code-editor.component";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { findDocs } from "@package/misc/db";
import { waitForRendererIdle, waitForStableValue } from "@package/misc/wait";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import type { Page } from "playwright-core";

export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigates to this page and waits until it is confirmed ready for
   * interaction. Each subclass implements this to wait on a
   * page-specific visible element that indicates the page has loaded.
   */
  abstract navigate(): Promise<void>;

  /**
   * Rewires this Page instance onto a fresh window — called by
   * `PageManager.setWindow()` after `AppFlow.restart()`.
   */
  setContext(page: Page): void {
    this.page = page;
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
   * Reads every live document of the model stored in `dbFile` from the
   * app's database.
   */
  protected async readPersistedDocs(dbFile: string): Promise<any[]> {
    return findDocs(this.page, dbFile);
  }

  /**
   * Polls the app's database until any live document in one of
   * `dbFiles` satisfies `predicate`. Use in place of a fixed sleep after
   * an edit the app saves through a debounce: the UI already shows the
   * new value, but a caller that navigates away or unmounts the editor
   * before the debounce fires can silently lose the write, and only the
   * app's database shows it has landed.
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
   * Polls the app's database until any live document in one of
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
   * Polls the app's database until any live document in one of
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
}
