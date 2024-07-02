import fs from 'fs';
// Based on node-graceful-fs

// The ISC License
// Copyright (c) 2011-2022 Isaac Z. Schlueter, Ben Noordhuis, and Contributors
// https://github.com/isaacs/node-graceful-fs/blob/main/LICENSE

// On Windows, A/V software can lock the directory, causing this
// to fail with an EACCES or EPERM if the directory contains newly
// created files.

const GRACEFUL_RENAME_TIMEOUT = 60000;
export function gracefulRename(
  from: string,
  to: string,
  cb: (error: NodeJS.ErrnoException | null) => void
) {
  const start = Date.now();
  let backoff = 0;
  fs.rename(from, to, function CB(er) {
    if (
      er &&
      (er.code === 'EACCES' || er.code === 'EPERM') &&
      Date.now() - start < GRACEFUL_RENAME_TIMEOUT
    ) {
      setTimeout(function renameRetry() {
        fs.stat(to, function onStats(stater) {
          if (stater && stater.code === 'ENOENT') {
            fs.rename(from, to, CB);
          } else {
            CB(er);
          }
        });
      }, backoff);
      if (backoff < 100) {
        backoff += 10;
      }
      return;
    }
    if (cb) {
      cb(er);
    }
  });
}
