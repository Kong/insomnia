// Merges the `coverage/raw` directory each CI shard uploads (see
// misc/coverage.ts and .github/workflows/insomnia-test.yml's parallel-test
// job) into a single report. Usage:
//   node misc/merge-coverage.js <dir-containing-one-raw-subdir-per-shard>
const path = require("node:path");
const fs = require("node:fs");
const { CoverageReport } = require("monocart-coverage-reports");

const downloadsDir = process.argv[2];
if (!downloadsDir) {
  console.error(
    "Usage: node misc/merge-coverage.js <dir-containing-one-raw-subdir-per-shard>",
  );
  process.exit(1);
}

const inputDir = fs
  .readdirSync(downloadsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(downloadsDir, entry.name));

if (!inputDir.length) {
  console.error(`No shard raw-coverage directories found in ${downloadsDir}`);
  process.exit(1);
}

new CoverageReport({
  name: "Insomnia E2E Coverage",
  inputDir,
  outputDir: path.resolve(__dirname, "..", "coverage-merged"),
  reports: ["v8", "console-summary"],
})
  .generate()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
