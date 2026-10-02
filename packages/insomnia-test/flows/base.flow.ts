import * as fs from "node:fs";
import path from "node:path";

import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import type { PageManager } from "../pages/page-manager";
import type { FlowManager } from "./flow-manager";

export abstract class BaseFlow {
  constructor(
    protected readonly flowManager: FlowManager,
    protected readonly pageManager: PageManager,
  ) {}

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
   * Reads the on-disk `dbFile` NeDB file directly for `id`'s
   * currently-persisted document, keeping only its latest revision.
   * @param dbFile - The NeDB filename to read, e.g. `"insomnia.GrpcRequest.db"`
   * @param id - The `_id` of the document to read
   * @returns The document's latest revision, or `undefined` if `id` has no document yet
   */
  private async readPersistedDoc(dbFile: string, id: string): Promise<any> {
    const dataPath = await this.flowManager.appFlow.getDataPath();
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
