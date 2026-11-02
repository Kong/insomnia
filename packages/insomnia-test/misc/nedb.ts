import * as fs from "node:fs";
import path from "node:path";

/**
 * Parses the app's on-disk NeDB append-log `dbFile` under `dataPath` into
 * its raw lines, oldest first. A document appears once per revision, and a
 * deletion is a later line carrying `$$deleted`.
 */
export function readNedbLines(dataPath: string, dbFile: string): any[] {
  return fs
    .readFileSync(path.join(dataPath, dbFile), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/**
 * Collapses `lines` to each document's latest revision, dropping the ones
 * whose latest revision is a deletion.
 */
export function latestLiveDocs(lines: any[]): any[] {
  const latest = new Map<string, any>();
  for (const doc of lines) {
    if (doc.$$deleted) latest.delete(doc._id);
    else latest.set(doc._id, doc);
  }
  return [...latest.values()];
}
