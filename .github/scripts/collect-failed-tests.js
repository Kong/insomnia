#!/usr/bin/env node
// Walks Playwright JSON reporter output (one or more files) and writes a
// deduped list of "file:line" locations for every test that ended up
// "unexpected" (failed after all in-job retries), so a follow-up job can
// re-run just those tests single-threaded.
//
// Usage: node collect-failed-tests.js <dir-of-json-reports> <output-file>

const fs = require('fs');
const path = require('path');

const [, , reportsDir, outFile] = process.argv;

if (!reportsDir || !outFile) {
  console.error('Usage: collect-failed-tests.js <reports-dir> <output-file>');
  process.exit(1);
}

const failed = new Set();

function walkSuite(suite) {
  for (const spec of suite.specs || []) {
    const isFailed = (spec.tests || []).some(test => test.status === 'unexpected');
    if (isFailed) {
      failed.add(`${spec.file}:${spec.line}`);
    }
  }
  for (const child of suite.suites || []) {
    walkSuite(child);
  }
}

const files = fs.existsSync(reportsDir)
  ? fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'))
  : [];

for (const file of files) {
  const report = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf8'));
  for (const suite of report.suites || []) {
    walkSuite(suite);
  }
}

fs.writeFileSync(outFile, Array.from(failed).sort().join('\n'));
console.log(`Found ${failed.size} failed test file(s) across ${files.length} report(s).`);
