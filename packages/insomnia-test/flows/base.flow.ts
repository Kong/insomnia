import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { readNedbLines } from "../misc/nedb";
import type { RequestAuthentication } from "../models/authentication";
import type { AuthTabComponent } from "../pages/auth-tab.page";
import type { PageManager } from "../pages/page-manager";
import type { FlowContext } from "./flow-context";

export abstract class BaseFlow {
  constructor(
    protected readonly flowManager: FlowContext,
    protected readonly pageManager: PageManager,
  ) {}

  /**
   * Applies `authentication` to a request pane's Auth tab. Only the types
   * in `RequestAuthentication` are supported; anything else is a compile
   * error, and a runtime error if one slips through a cast.
   */
  protected async applyAuthentication(
    auth: AuthTabComponent,
    authentication: RequestAuthentication,
  ): Promise<void> {
    switch (authentication.type) {
      case "none": {
        return auth.setNoAuthentication();
      }
      case "bearer": {
        return auth.setBearerFields(authentication);
      }
      case "basic": {
        return auth.setBasicFields(authentication);
      }
      case "apikey": {
        return auth.setApiKeyFields(authentication);
      }
      case "oauth2": {
        return auth.setOAuth2Fields(authentication);
      }
      case "singleToken": {
        return auth.setSingleTokenFields(authentication);
      }
      default: {
        const unsupported: never = authentication;
        throw new Error(
          `Unsupported authentication type: ${(unsupported as { type: string }).type}`,
        );
      }
    }
  }

  /**
   * Narrows a possibly-`undefined` lookup result, throwing if the item
   * that was supposedly just created can't actually be found.
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
   */
  protected async waitForChildDocId(
    dbFile: string,
    parentId: string,
  ): Promise<string> {
    const dataPath = await this.flowManager.getDataPath();

    let id: string | undefined;
    await expect(async () => {
      for (const doc of readNedbLines(dataPath, dbFile)) {
        if (doc.parentId === parentId) id = doc._id;
      }
      expect(id).toBeDefined();
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return id!;
  }

  /**
   * Reads the on-disk `dbFile` NeDB file directly for `id`'s
   * currently-persisted document, keeping only its latest revision.
   */
  private async readPersistedDoc(dbFile: string, id: string): Promise<any> {
    const dataPath = await this.flowManager.getDataPath();

    let latest: any;
    for (const doc of readNedbLines(dataPath, dbFile)) {
      if (doc._id === id) latest = doc;
    }
    return latest;
  }
}
