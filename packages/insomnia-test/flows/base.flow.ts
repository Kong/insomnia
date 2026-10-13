import * as fs from "node:fs";
import path from "node:path";

import { expect } from "@playwright/test";
import type { RequestAuthentication } from "insomnia-data";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import type { AuthTabComponent } from "../pages/auth-tab.page";
import type { PageManager } from "../pages/page-manager";
import type { FlowContext } from "./flow-context";

export abstract class BaseFlow {
  constructor(
    protected readonly flowManager: FlowContext,
    protected readonly pageManager: PageManager,
  ) {}

  /**
   * Applies `authentication` to a request pane's Auth tab. Only None,
   * Basic, API Key, Bearer Token, OAuth 2.0 and the single-token type are
   * wired up here.
   * @param auth - The request page's Auth tab component
   * @param authentication - The authentication config to apply
   */
  protected async applyAuthentication(
    auth: AuthTabComponent,
    authentication: RequestAuthentication,
  ): Promise<void> {
    if (authentication.type === "none") {
      await auth.setNoAuthentication();
    }
    if (authentication.type === "bearer") {
      await auth.setBearerFields(authentication);
    }
    if (authentication.type === "basic") {
      await auth.setBasicFields(authentication);
    }
    if (authentication.type === "apikey") {
      await auth.setApiKeyFields(authentication);
    }
    if (authentication.type === "oauth2") {
      await auth.setOAuth2Fields(authentication);
    }
    if (authentication.type === "singleToken") {
      await auth.setSingleTokenFields(authentication);
    }
  }

  /**
   * Narrows a possibly-`undefined` lookup result, throwing if the item
   * that was supposedly just created can't actually be found.
   * @param item - The result of re-fetching the just-created item
   * @param name - The name used in the thrown error, for diagnostics
   * @returns `item`, narrowed to non-`undefined`
   */
  protected assertCreated<T>(item: T | undefined, name: string): T {
    if (item === undefined) {
      throw new Error(`Failed to find "${name}" after creation`);
    }
    return item;
  }

  /**
   * Polls the on-disk `dbFile` NeDB file directly until `id`'s persisted
   * document settles on `expected` for `field`, optionally re-running
   * `onMismatch` first whenever a read still disagrees. The app can patch
   * a just-written field into a document's on-disk state in the
   * background rather than synchronously, so a UI read-back right after a
   * setter call can observe a value that a later background write then
   * reverts — reading the same on-disk store the app itself acts on is
   * the only way to know a value has actually landed.
   *
   * Most callers only need to wait (`onMismatch` omitted) for that
   * background write to settle on its own — see
   * `GrpcRequestFlow`'s URL/body waits. `onMismatch` covers the rarer
   * case where the value never lands on its own and the same write needs
   * to be repeated once the earlier background patch has landed — see
   * `HttpRequestFlow`'s URL wait for why passive waiting alone isn't
   * always enough there.
   * @param dbFile - The NeDB filename to read, e.g. `"insomnia.Request.db"`
   * @param id - The `_id` of the document to check
   * @param field - Reads the value under test off a document
   * @param expected - The value `field` must settle on
   * @param onMismatch - Optional retry action to run when a read still disagrees, before the next poll
   */
  protected async waitForFieldPersisted<T>(
    dbFile: string,
    id: string,
    field: (doc: any) => T,
    expected: T,
    onMismatch?: () => Promise<void>,
  ): Promise<void> {
    await expect(async () => {
      let doc = await this.readPersistedDoc(dbFile, id);
      if (onMismatch && field(doc) !== expected) {
        await onMismatch();
        doc = await this.readPersistedDoc(dbFile, id);
      }
      expect(field(doc)).toBe(expected);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Confirms `id`'s URL actually persisted as `url`, re-issuing
   * `page.setUrl()` if not. `setUrl()` only confirms the live CodeMirror
   * value; the app's own background patch of a still-initializing request
   * document can silently revert it (reliably reproducible for a URL
   * containing a `{% %}` tag, whose inline widget re-renders the editor
   * around the same time), and a later connect/send then fails with a
   * "URL is required" error or hits the previous address. Passive waiting
   * never recovers from that — the value only lands once the write is
   * repeated after the initial patch has landed — so this re-sends the
   * same write once the on-disk store shows it was lost.
   * @param dbFile - The NeDB filename holding the request, e.g. `"insomnia.Request.db"`
   * @param page - The request page `url` was just set on
   * @param id - The `_id` of the request whose URL was just set
   * @param url - The URL that must be the persisted value
   */
  protected async waitForUrlPersisted(
    dbFile: string,
    page: { setUrl(url: string): Promise<void> },
    id: string,
    url: string,
  ): Promise<void> {
    await this.waitForFieldPersisted(
      dbFile,
      id,
      (doc) => doc?.url,
      url,
      () => page.setUrl(url),
    );
  }

  /**
   * Polls the on-disk `dbFile` NeDB file until a document whose `parentId`
   * is `parentId` exists, and returns its `_id`. For models created by the
   * app as a hidden child of a node the UI exposes (e.g. an MCP Client's
   * McpRequest under its workspace), so the tree node's id is the parent's
   * rather than the document's own.
   * @param dbFile - The NeDB filename to read, e.g. `"insomnia.McpRequest.db"`
   * @param parentId - The `parentId` of the document to find
   * @returns The `_id` of the child document
   */
  protected async waitForChildDocId(
    dbFile: string,
    parentId: string,
  ): Promise<string> {
    const dataPath = await this.flowManager.getDataPath();
    const dbPath = path.join(dataPath, dbFile);

    let id: string | undefined;
    await expect(async () => {
      for (const line of fs
        .readFileSync(dbPath, "utf8")
        .split("\n")
        .filter(Boolean)) {
        const doc = JSON.parse(line);
        if (doc.parentId === parentId) id = doc._id;
      }
      expect(id).toBeDefined();
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return id!;
  }

  /**
   * Reads the on-disk `dbFile` NeDB file directly for `id`'s
   * currently-persisted document, keeping only its latest revision.
   * @param dbFile - The NeDB filename to read, e.g. `"insomnia.GrpcRequest.db"`
   * @param id - The `_id` of the document to read
   * @returns The document's latest revision, or `undefined` if `id` has no document yet
   */
  private async readPersistedDoc(dbFile: string, id: string): Promise<any> {
    const dataPath = await this.flowManager.getDataPath();
    const dbPath = path.join(dataPath, dbFile);

    let latest: any;
    for (const line of fs
      .readFileSync(dbPath, "utf8")
      .split("\n")
      .filter(Boolean)) {
      const doc = JSON.parse(line);
      if (doc._id === id) latest = doc;
    }
    return latest;
  }
}
