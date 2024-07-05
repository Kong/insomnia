import fs from 'fs/promises';

import { isWindows } from '../../../common/constants';
// Based on node-graceful-fs and vs-code's take on renaming files in a way that is more resilient to Windows locking renames
// https://github.com/microsoft/vscode/pull/188899/files#diff-2bf233effbb62ea789bb7c4739d222a43ccd97ed9f1219f75bb07e9dee91c1a7R529
// On Windows, A/V software can lock the directory, causing this
// to fail with an EACCES or EPERM if the directory contains newly
// created files.

const WINDOWS_RENAME_TIMEOUT = 60000; // 1 minute

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function renameWithRetry(source: string, target: string, startTime: number, retryTimeout: number, attempt = 0): Promise<void> {
  try {
    return await fs.rename(source, target);
  } catch (error) {
    if (error.code !== 'EACCES' && error.code !== 'EPERM' && error.code !== 'EBUSY') {
      // only for errors we think are temporary
      throw error;
    }

    if (Date.now() - startTime >= retryTimeout) {
      console.error(`[node.js fs] rename failed after ${attempt} retries with error: ${error}`);
      // give up after configurable timeout
      throw error;
    }

    if (attempt === 0) {
      let abortRetry = false;
      try {
        const stat = await fs.stat(target);
        if (!stat.isFile()) {
          abortRetry = true; // if target is not a file, EPERM error may be raised and we should not attempt to retry
        }
      } catch (error) {
        // Ignore
      }

      if (abortRetry) {
        throw error;
      }
    }

    // Delay with incremental backoff up to 100ms
    await wait(Math.min(100, attempt * 10));

    // Attempt again
    return renameWithRetry(source, target, startTime, retryTimeout, attempt + 1);
  }
}

export async function gracefulRename(
  from: string,
  to: string,
) {
  if (isWindows()) {
    return renameWithRetry(from, to, Date.now(), WINDOWS_RENAME_TIMEOUT);
  }

  return fs.rename(from, to);
}
