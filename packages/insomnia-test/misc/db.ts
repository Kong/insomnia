import fs from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";

/**
 * Queries the app's database through the same `window.database` bridge the
 * renderer uses, so tests read the documents the app acts on rather than
 * parsing its on-disk NeDB files. `dbFile` is the model's file name
 * (`insomnia.Request.db`), kept so callers still name the model they mean.
 */
export async function findDocs(
  page: Page,
  dbFile: string,
  query: Record<string, unknown> = {},
): Promise<any[]> {
  const type = /^insomnia\.(.+)\.db$/.exec(dbFile)?.[1];
  if (!type) throw new Error(`Not a model db file name: ${dbFile}`);
  return page.evaluate(
    ([t, q]) =>
      (window as any).database.invoke("find", t, q) as Promise<any[]>,
    [type, query] as const,
  );
}

/** Matches a value written by the field-encryption layer. */
export const ENCRYPTED_VALUE = /^enc:insomnia:v1:/;

/**
 * Reads a model's on-disk NeDB file straight from `dataPath` (one parsed
 * document per line) — unlike `findDocs`, which goes through the app's
 * `window.database` bridge and so sees the already-decrypted values.
 */
export function readRawDocs(dataPath: string, type: string): any[] {
  const file = path.join(dataPath, `insomnia.${type}.db`);
  if (!fs.existsSync(file)) return [];
  // NeDB files are append-only: a document's latest line wins, and a
  // `$$deleted` line removes it.
  const latest = new Map<string, any>();
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line === "") continue;
    const doc = JSON.parse(line);
    if (doc.$$deleted) latest.delete(doc._id);
    else latest.set(doc._id, doc);
  }
  return [...latest.values()];
}

/** The concatenated text of every `insomnia.*.db` file in `dataPath`. */
export function readRawDbText(dataPath: string): string {
  return fs
    .readdirSync(dataPath)
    .filter((file) => /^insomnia\..+\.db$/.test(file))
    .map((file) => fs.readFileSync(path.join(dataPath, file), "utf8"))
    .join("\n");
}

/**
 * Creates a document through the app's own database layer (the same
 * `window.database` bridge the renderer's models use), so it goes through
 * the field-encryption hooks exactly like a document written by the UI.
 * Use it to set up model types the framework has no Page/Flow for.
 */
export async function createDoc(
  page: Page,
  type: string,
  patch: Record<string, unknown>,
): Promise<any> {
  return page.evaluate(
    ([t, p]) => (window as any).database.invoke("docCreate", t, p) as Promise<any>,
    [type, patch] as const,
  );
}

/** Merges `patch` into an existing document through the app's database layer. */
export async function updateDoc(
  page: Page,
  type: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<any> {
  return page.evaluate(
    async ([t, i, p]) => {
      const db = (window as any).database;
      const original = await db.invoke("findOne", t, { _id: i });
      return db.invoke("docUpdate", original, p);
    },
    [type, id, patch] as const,
  );
}
