#!/usr/bin/env node
// Splices sequential-test's rerun attempts into the shard blob report that
// originally ran each test, as additional (higher-numbered) retries of the
// same testId, instead of leaving them in a separate blob-report-rerun.zip.
//
// Playwright's `merge-reports` salts any testId that reappears in a second
// blob (see IdsPatcher._mapTestId in playwright/lib/reporters/merge.js) —
// it assumes blobs cover disjoint test sets, as true shards do. Because
// blob-report-rerun.zip re-runs tests that already exist in one of the
// shard blobs, the merged report used to show that test twice instead of
// once with an extra "Retry #N" attempt.
//
// Usage: node stitch-rerun-attempts.js <blob-reports-dir>
// Mutates blob-report-<N>.zip files in place and deletes blob-report-rerun.zip
// once every rerun test has been folded into its origin shard.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [, , dir] = process.argv;
if (!dir) {
  console.error('Usage: stitch-rerun-attempts.js <blob-reports-dir>');
  process.exit(1);
}

const rerunZip = path.join(dir, 'blob-report-rerun.zip');
if (!fs.existsSync(rerunZip)) {
  console.log('No blob-report-rerun.zip found, nothing to stitch.');
  process.exit(0);
}

const shardZips = fs.readdirSync(dir)
  .filter(f => /^blob-report-\d+\.zip$/.test(f))
  .map(f => ({ file: f, zipPath: path.join(dir, f) }));

if (shardZips.length === 0) {
  console.log('No shard blob-report-<N>.zip files found, nothing to stitch.');
  process.exit(0);
}

const workDir = path.join(dir, '.stitch-work');
fs.rmSync(workDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

function unzip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', destDir]);
}

function rezip(srcDir, zipPath) {
  fs.rmSync(zipPath, { force: true });
  const entries = fs.readdirSync(srcDir);
  // -D: no directory entries. Playwright's merge-reports (extractAndParseReports
  // in playwright/lib/reporters/merge.js) reads every zip entry as a file, so a
  // bare "resources/" directory entry makes it crash with EISDIR.
  execFileSync('zip', ['-q', '-r', '-D', path.resolve(zipPath), ...entries], { cwd: srcDir });
}

function findJsonl(dir) {
  const file = fs.readdirSync(dir).find(f => f.endsWith('.jsonl'));
  return file ? path.join(dir, file) : null;
}

function readJsonl(file) {
  if (!file || !fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function writeJsonl(file, events) {
  fs.writeFileSync(file, events.map(e => JSON.stringify(e) + '\n').join(''));
}

function testIdOf(event) {
  switch (event.method) {
    case 'onTestBegin':
    case 'onStepBegin':
    case 'onStepEnd':
    case 'onAttach':
    case 'onStdIO':
      return event.params.testId;
    case 'onTestEnd':
      return event.params.test.testId;
    default:
      return undefined;
  }
}

// --- Extract the rerun blob and split its events into per-test attempts ---
const rerunDir = path.join(workDir, 'rerun');
unzip(rerunZip, rerunDir);
const rerunEvents = readJsonl(findJsonl(rerunDir));

// testId -> array of attempts, each attempt an ordered array of events
// starting with its onTestBegin.
const rerunAttemptsByTestId = new Map();
for (const event of rerunEvents) {
  const testId = testIdOf(event);
  if (testId === undefined)
    continue;
  let attempts = rerunAttemptsByTestId.get(testId);
  if (!attempts)
    rerunAttemptsByTestId.set(testId, attempts = []);
  if (event.method === 'onTestBegin')
    attempts.push([event]);
  else
    attempts[attempts.length - 1].push(event);
}

if (rerunAttemptsByTestId.size === 0) {
  console.log('Rerun blob contains no test events, nothing to stitch.');
  fs.rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
}

// --- Extract every shard blob once, so we can find which shard originally
// ran each rerun testId without needing to know that ahead of time. ---
const shards = shardZips.map(({ file, zipPath }) => {
  const shardDir = path.join(workDir, file.replace(/\.zip$/, ''));
  unzip(zipPath, shardDir);
  const jsonlPath = findJsonl(shardDir);
  const events = readJsonl(jsonlPath);
  const maxRetryByTestId = new Map();
  for (const event of events) {
    if (event.method !== 'onTestBegin')
      continue;
    const { testId, result } = event.params;
    if (!maxRetryByTestId.has(testId) || result.retry > maxRetryByTestId.get(testId))
      maxRetryByTestId.set(testId, result.retry);
  }
  return { zipPath, shardDir, jsonlPath, events, maxRetryByTestId, changed: false };
});

const unmatched = [];

for (const [testId, attempts] of rerunAttemptsByTestId) {
  const shard = shards.find(s => s.maxRetryByTestId.has(testId));
  if (!shard) {
    unmatched.push(testId);
    continue;
  }
  let nextRetry = shard.maxRetryByTestId.get(testId) + 1;
  for (const attempt of attempts) {
    for (const event of attempt) {
      if (event.method === 'onTestBegin') {
        event.params.result.retry = nextRetry;
      } else if (event.method === 'onAttach') {
        for (const attachment of event.params.attachments || []) {
          if (!attachment.path)
            continue;
          const src = path.join(rerunDir, attachment.path);
          const dest = path.join(shard.shardDir, attachment.path);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
        }
      }
    }
    shard.events.push(...attempt);
    nextRetry++;
  }
  shard.changed = true;
}

for (const shard of shards) {
  if (!shard.changed)
    continue;
  writeJsonl(shard.jsonlPath, shard.events);
  rezip(shard.shardDir, shard.zipPath);
  console.log(`Stitched rerun attempt(s) into ${path.basename(shard.zipPath)}`);
}

if (unmatched.length > 0) {
  console.warn(`Warning: ${unmatched.length} rerun test(s) had no matching shard, keeping blob-report-rerun.zip as a fallback: ${unmatched.join(', ')}`);
} else {
  fs.rmSync(rerunZip);
  console.log('Removed blob-report-rerun.zip (fully folded into shard blobs).');
}

fs.rmSync(workDir, { recursive: true, force: true });
