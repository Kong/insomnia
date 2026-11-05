import { AuthTabComponent } from "@package/components/auth-tab.component";
import { DropdownComponent } from "@package/components/dropdown.component";
import { KeyValueEditorComponent } from "@package/components/key-value-editor.component";
import { ScriptTabComponent } from "@package/components/script-tab.component";
import { SelectComponent } from "@package/components/select.component";
import { TabPanelComponent } from "@package/components/tab-panel.component";
import type { HttpMethod } from "@package/enums/http-method";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import { throwOnDialog } from "@package/misc/decorators";
import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import type {
  RequestHeader,
  RequestParameter,
} from "insomnia-data";
import type { Page } from "playwright-core";

import { BasePage } from "./base.page";

const REQUEST_PANE = '[data-testid="request-pane"]';

interface KeyValuePair {
  name: string;
  value: string;
  disabled?: boolean;
}

export abstract class RequestPage extends BasePage {
  protected readonly PANE = REQUEST_PANE;

  protected readonly METHOD_BUTTON =
    '[data-testid="request-pane"] button[aria-label="Request Method"]';
  /** The key/value row editor in the active tab panel (params, headers, body params…). */
  protected get keyValue(): KeyValueEditorComponent {
    return new KeyValueEditorComponent(
      this.page,
      this.page.locator(this.TABPANEL),
      this.hasTrailingBlankRow,
    );
  }
  protected get sendButtonLocator(): Locator {
    return this.page
      .locator(this.PANE)
      .getByRole("button", { name: "Send", exact: true });
  }

  protected abstract readonly urlBarId: string;

  /** The NeDB file this protocol's requests persist to; subclasses of a non-HTTP protocol override it. */
  protected readonly persistedDbFile: string = "insomnia.Request.db";

  /**
   * Dotted paths to the name/value row lists on a persisted request
   * document that a Params/Headers edit lands in. Data rather than a
   * method on purpose: the step instrumentation wraps page methods into
   * async ones, which a synchronous per-document read can't be.
   */
  /** Whether the key/value editor keeps a blank row appended after the persisted rows (gRPC's doesn't). */
  protected readonly hasTrailingBlankRow: boolean = true;
  protected readonly persistedRowPaths: string[] = [
    "parameters",
    "headers",
    "body.params",
  ];

  // Getters, not fields: the components are bound to the current window, so
  // building them on access keeps them following `this.page`.
  /** The tab-bar pane of this request. */
  protected get panel(): TabPanelComponent {
    return new TabPanelComponent(this.page, this.PANE);
  }

  protected get TABPANEL(): string {
    return this.panel.TABPANEL;
  }

  /** The Auth tab component for this request's own pane. */
  get auth(): AuthTabComponent {
    return new AuthTabComponent(this.page, this.PANE);
  }

  /** The Scripts tab component for this request's own pane. */
  get scripts(): ScriptTabComponent {
    return new ScriptTabComponent(this.page, this.PANE);
  }

  /**
   * Waits for this request's pane to become visible, confirming it's open
   * and active.
   */
  async navigate(): Promise<void> {
    await this.panel.waitUntilVisible();
  }

  /**
   * Clicks the tab within this request's pane identified by its data-key.
   */
  protected async switchTab(tab: string): Promise<void> {
    await this.panel.switchTab(tab);
  }

  /**
   * Builds the CSS selector for this request type's URL bar CodeMirror
   * editor, using the subclass-provided urlBarId to disambiguate between
   * request protocols.
   */
  protected get URL_BAR(): string {
    return `${this.PANE} #${this.urlBarId} + .CodeMirror`;
  }

  /**
   * Reads the currently selected request method from the method button.
   */
  async getMethod(): Promise<string> {
    return this.page.locator(this.METHOD_BUTTON).innerText();
  }

  /**
   * Reads back the request's current query parameters.
   */
  async getParams(): Promise<RequestParameter[]> {
    return this.readKeyValuePairs("params");
  }

  /**
   * Reads the current value of the URL bar's CodeMirror editor. Confirmed
   * live: right after re-navigating to a just-created/edited request (e.g.
   * `HttpRequestFlow.create()`'s own read-back), the URL bar's CodeMirror
   * instance can still be mid-remount — reading through immediately can
   * race that and observe no instance at all, not merely a stale value —
   * so this polls until an instance is actually attached before reading it.
   */
  async getUrl(): Promise<string> {
    const urlBar = this.page.locator(this.URL_BAR);
    await expect(async () => {
      const attached = await urlBar.evaluate((el) => !!(el as any).CodeMirror);
      expect(attached).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return urlBar.evaluate((el) => (el as any).CodeMirror.getValue());
  }

  /**
   * Reads back all key/value pairs currently shown on the given tab,
   * including each row's enabled/disabled toggle state. Rows with no
   * toggle button are treated as always enabled.
   */
  protected async readKeyValuePairs(tab: string): Promise<KeyValuePair[]> {
    await this.switchTab(tab);
    return this.keyValue.read();
  }

  /**
   * Switches to the content-type tab and selects the given body type
   * from the "Change Body Type" dropdown.
   */
  protected async selectBodyType(contentType: string): Promise<void> {
    await this.switchTab("content-type");
    const panel = this.page.locator(this.TABPANEL);
    const select = new SelectComponent(
      this.page,
      panel.locator('button[aria-label="Change Body Type"]'),
    );
    await expect(async () => {
      await select.select(contentType);
      expect(await select.nativeValue(panel)).toBe(contentType);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the Send button to fire the request.
   */
  @throwOnDialog()
  async send(): Promise<void> {
    await this.sendButtonLocator.click();
  }

  /**
   * Sets the request's headers.
   */
  async setHeaders(headers: RequestHeader[]): Promise<void> {
    await this.setKeyValuePairs("headers", headers);
  }

  /**
   * Replaces the key/value pairs shown on the given tab (e.g. params or
   * headers): switches to the tab, clears all existing rows via "Delete
   * all" if enabled, then adds a new row per pair, filling its name and
   * value editors and toggling it off if marked disabled. Waits between
   * edits since new rows are appended asynchronously.
   */
  protected async setKeyValuePairs(
    tab: string,
    pairs: KeyValuePair[],
  ): Promise<void> {
    await this.switchTab(tab);
    const panel = this.page.locator(this.TABPANEL);
    await this.keyValue.deleteAll();
    const options = this.keyValue.rows;
    for (const [index, pair] of pairs.entries()) {
      // Without a trailing blank row the only blank row is the initial one
      // shown while the list is empty; later rows must be added explicitly.
      if (!this.hasTrailingBlankRow && index > 0) {
        await this.keyValue.addButton.click();
      }
      // Locate the row by its fixed position: once it is persisted a new
      // trailing blank row is appended, so `.last()` would no longer be it.
      const rowIndex = (await options.count()) - 1;
      const row = options.nth(rowIndex);
      const setName = () =>
        this.keyValue.nameEditor(row).setValue(pair.name);
      const setValue = () =>
        this.keyValue.valueEditor(row).setValue(pair.value);
      await setName();
      await this.waitForPairPersisted(pair, {
        checkValue: false,
        reapply: setName,
      });
      // The disk write lands before the editor's props catch up with it.
      // A row keeps its `pair-blank_*` id once persisted, and the editor
      // only mints a fresh trailing blank row after it has re-rendered
      // from the persisted data. Typing the value earlier lets that late
      // re-render reset the value editor back to its stale default.
      await expect(options).toHaveCount(
        rowIndex + (this.hasTrailingBlankRow ? 2 : 1),
        { timeout: DEFAULT_TIMEOUT },
      );
      await setValue();
      if (pair.disabled) {
        await row.locator('button[aria-pressed="true"]').click();
      }
      await this.waitForPairPersisted(pair, {
        reapply: async () => {
          await setName();
          await setValue();
          await this.syncRowToggle(row, pair);
        },
      });
    }
    await this.waitForPairsSettled(pairs);
  }

  /**
   * Polls the on-disk request documents until a single row list holds
   * every pair in `pairs` at once, and keeps holding for `settleMs`. Each
   * row's own save is confirmed as it's made, but the editors save from a
   * copy of the row list that can be stale, so a later row's save can
   * silently revert an earlier row's value; matching by name alone also
   * can't tell apart rows that share one (e.g. repeated `key` params).
   * Pairs still missing after a while are re-typed into their row, which
   * sits at the same index as the pair in `pairs`.
   */
  protected async waitForPairsSettled(
    pairs: { name: string; value?: string; disabled?: boolean; fileName?: string }[],
    settleMs = 1500,
  ): Promise<void> {
    const wanted = pairs
      .map((pair, index) => ({ pair, index }))
      .filter(({ pair }) => pair.name && !pair.fileName);
    if (wanted.length === 0) return;
    const rows = this.page.locator(`${this.TABPANEL} [role="listbox"] [role="option"]`);
    const holds = (list: unknown, pair: (typeof pairs)[number]) =>
      Array.isArray(list) &&
      list.some(
        (p) =>
          p.name === pair.name &&
          (p.value ?? "") === (pair.value ?? "") &&
          Boolean(p.disabled) === Boolean(pair.disabled),
      );
    const start = Date.now();
    let lastReapply = start;
    let heldSince = 0;
    await expect(async () => {
      const docs = await this.readPersistedDocs(this.persistedDbFile);
      let missing = wanted;
      for (const doc of docs) {
        for (const path of this.persistedRowPaths) {
          const list = path.split(".").reduce((node, key) => node?.[key], doc);
          const docMissing = wanted.filter(({ pair }) => !holds(list, pair));
          if (docMissing.length < missing.length) missing = docMissing;
        }
      }
      if (missing.length === 0) {
        heldSince ||= Date.now();
        expect(Date.now() - heldSince).toBeGreaterThanOrEqual(settleMs);
        return;
      }
      heldSince = 0;
      if (Date.now() - lastReapply >= 2000) {
        lastReapply = Date.now();
        // One row at a time, waiting for each save to land: re-typing every
        // missing row back-to-back would recreate the stale-row-list race.
        for (const { pair, index } of missing) {
          const row = rows.nth(index);
          // The editor can already show the right text while the saved row
          // list lacks it; re-setting identical text fires no save, so
          // detour through a different value to force a fresh save.
          const nameEditor = this.keyValue.nameEditor(row).codeMirror;
          const valueEditor = this.keyValue.valueEditor(row).codeMirror;
          // Each step of the detour must land on disk before the next one:
          // firing the detour value and its restore back-to-back lets the
          // editor's late re-render swallow the restore, stranding the row
          // on the detour text (e.g. `key-`).
          await this.setCodeMirrorValue(nameEditor, `${pair.name}-`);
          await this.waitForPairPersisted(
            { name: `${pair.name}-` },
            { checkValue: false },
          ).catch(() => {});
          await this.setCodeMirrorValue(nameEditor, pair.name);
          await this.waitForPairPersisted(pair, { checkValue: false }).catch(
            () => {},
          );
          await this.setCodeMirrorValue(valueEditor, `${pair.value ?? ""}-`);
          await this.waitForPairPersisted({
            ...pair,
            value: `${pair.value ?? ""}-`,
          }).catch(() => {});
          await this.setCodeMirrorValue(valueEditor, pair.value ?? "");
          await this.syncRowToggle(row, pair);
          await this.waitForPairPersisted(pair).catch(() => {});
        }
      }
      expect(missing.map(({ pair }) => pair.name)).toEqual([]);
    }).toPass({
      timeout: DEFAULT_TIMEOUT * 2 + settleMs,
      intervals: [250, 500],
    });
  }

  /**
   * Flips a row's enable toggle if it doesn't match `pair.disabled`. Rows
   * without a toggle are left alone.
   */
  protected async syncRowToggle(
    row: Locator,
    pair: { disabled?: boolean },
  ): Promise<void> {
    const toggle = row.locator("button[aria-pressed]");
    if ((await toggle.count()) === 0) return;
    const enabled = (await toggle.getAttribute("aria-pressed")) === "true";
    if (enabled === Boolean(pair.disabled)) await toggle.click();
  }

  /**
   * Polls the on-disk request documents until one lists `pair` among its
   * parameters, headers, or form-body params — confirming the row's
   * debounced save has landed (and the row has settled onto its
   * persisted key) before the next edit builds on it. Skipped for a
   * blank name, which the app never persists.
   */
  protected async waitForPairPersisted(
    pair: { name: string; value?: string; disabled?: boolean },
    {
      checkValue = true,
      reapply,
    }: { checkValue?: boolean; reapply?: () => Promise<void> } = {},
  ): Promise<void> {
    let attempts = 0;
    await expect(async () => {
      if (attempts++ > 0) await reapply?.();
      await this.waitForRowPersisted(
        [this.persistedDbFile],
        (doc) =>
          this.persistedRowPaths.map((path) =>
            path.split(".").reduce((node, key) => node?.[key], doc),
          ),
        pair.name,
        checkValue
          ? (p) =>
              (p.value ?? "") === (pair.value ?? "") &&
              Boolean(p.disabled) === Boolean(pair.disabled)
          : undefined,
        DEFAULT_TIMEOUT / 2,
      );
    }).toPass({
      timeout: reapply ? DEFAULT_TIMEOUT * 3 : DEFAULT_TIMEOUT,
      intervals: [0],
    });
  }

  /**
   * Opens the request method dropdown and selects the given method,
   * then waits for the method button to reflect the new selection.
   */
  async setMethod(method: HttpMethod): Promise<void> {
    await new DropdownComponent(
      this.page,
      this.page.locator(this.METHOD_BUTTON),
    ).select(method);
    await expect(this.page.locator(this.METHOD_BUTTON)).toHaveText(method);
  }

  /**
   * Sets the request's query parameters.
   */
  async setParams(params: RequestParameter[]): Promise<void> {
    await this.setKeyValuePairs("params", params);
  }

  /**
   * Sets the request URL by writing into the URL bar's CodeMirror editor.
   * `setCodeMirrorValue()` itself now handles retrying past a revert
   * (e.g. a `{{ }}`/`{% %}` tag's inline widget redrawing and racing the
   * value back to its old content shortly after the write) — a caller
   * that immediately re-navigates (e.g. `HttpRequestFlow.create()`'s own
   * read-back right after also setting the body) could otherwise observe
   * this field having raced back to empty.
   *
   * This only confirms the live editor value, not that it has been
   * persisted to disk — see `HttpRequestFlow`/`GrpcRequestFlow`'s
   * `waitForUrlPersisted()` for that separate, stricter check.
   */
  async setUrl(url: string): Promise<void> {
    await this.setCodeMirrorValue(this.page.locator(this.URL_BAR), url);
  }
}
