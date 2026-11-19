import * as fs from "node:fs";

import { ACTION_TIMEOUT, POLL_INTERVAL } from "./constants";

const STABLE_CHECKS_REQUIRED = 3;

/**
 * Polls `filePath` until it exists and its size stops changing across
 * several consecutive checks, then returns its content. An export writes
 * its file asynchronously after the native save dialog resolves, so a
 * single existence check can read a truncated file mid-write.
 */
export async function waitForExportedFile(
  filePath: string,
  timeout = ACTION_TIMEOUT,
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
          return fs.readFileSync(filePath, "utf8");
        }
      } else {
        stableChecks = 0;
        lastSize = size;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }

  throw new Error(`Exported file never stabilized within ${timeout}ms: ${filePath}`);
}
