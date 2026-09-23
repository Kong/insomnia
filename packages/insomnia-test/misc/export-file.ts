import * as fs from "fs";

const POLL_INTERVAL_MS = 200;
const STABLE_CHECKS_REQUIRED = 3;

/**
 * Polls `filePath` until it exists and its size stops changing across
 * several consecutive checks, then returns its content. An export writes
 * its file asynchronously after the native save dialog resolves, so a
 * single existence check can read a truncated file mid-write.
 * @param filePath - Absolute path of the file an export is expected to write
 * @param timeout - Milliseconds to wait before giving up
 * @returns The file's content once its size has stabilized
 */
export async function waitForExportedFile(
  filePath: string,
  timeout: number = 20000,
): Promise<string> {
  const deadline = Date.now() + timeout;
  let lastSize = -1;
  let stableChecks = 0;

  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      if (size > 0 && size === lastSize) {
        stableChecks++;
        if (stableChecks >= STABLE_CHECKS_REQUIRED) {
          return fs.readFileSync(filePath, "utf-8");
        }
      } else {
        stableChecks = 0;
        lastSize = size;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Exported file never stabilized within ${timeout}ms: ${filePath}`);
}

/** Field names whose values are freshly generated on every export (ids,
 * timestamps, sort order) rather than derived from the exported data
 * itself — comparing an export against a fixture must normalize these
 * first. Covers both the YAML/JSON "Insomnia v5" shape (`id`, `created`,
 * `modified`, `sortKey`) and the HAR shape (`startedDateTime`). */
const DYNAMIC_FIELDS = ["id", "created", "modified", "sortKey", "startedDateTime"];

/**
 * Replaces every dynamic field's value in an exported file's raw text
 * (YAML or JSON) with a fixed `<FIELD_NAME>` placeholder, so the result
 * can be diffed against a checked-in fixture regardless of the random
 * ids/timestamps a real export always produces. Applies to both sides of
 * a comparison — normalize the fresh export and the fixture the same way
 * before comparing.
 * @param content - The raw exported file content (YAML or JSON)
 * @returns `content` with every dynamic field's value replaced by a placeholder
 */
export function normalizeExportFixture(content: string): string {
  let normalized = content;
  for (const field of DYNAMIC_FIELDS) {
    normalized = normalized.replace(
      new RegExp(`^(\\s*"?${field}"?\\s*[:=]\\s*)("[^"]*"|-?[0-9a-zA-Z_]+)`, "gm"),
      `$1<${field.toUpperCase()}>`,
    );
  }
  return normalized;
}
