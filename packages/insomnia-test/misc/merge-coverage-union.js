// Merges each shard's `v8-report.json` (a per-shard, already-correct monocart
// `v8-json` report — see misc/coverage.ts) into one report by taking the
// per-byte/line/statement/branch/function UNION across shards, instead of
// asking monocart-coverage-reports to merge the raw V8 ScriptCov entries
// itself.
//
// Why: monocart's own multi-run V8 coverage merge (lib/utils/merge/merge.js,
// used by misc/merge-coverage.js) has a bug where merging a script's coverage
// from shards with very different coverage levels can produce a result LOWER
// than any individual shard — a union should only ever grow. Confirmed via a
// minimal repro (same `id`/`sourcePath`, same `total`, but merged `covered`
// line count sits far below the max individual shard's `covered` count, even
// after pre-consolidating each shard's own data before the cross-shard
// merge). Each shard's own report is correct (the bug only triggers on the
// N-way cross-shard merge), so we read those correct per-shard numbers
// directly and union them ourselves at the range level, which is
// mathematically exactly "was this byte/line/branch/function executed by any
// test in the full suite".
//
// This reuses monocart's own HTML/JSON report renderers (`saveV8Report`) by
// handing them pre-unioned per-file data — never its merge functions, which
// is where the bug lives.
//
// Trade-off: a line's `data.lines` value collapses to a plain 0/1 (covered or
// not), rather than monocart's normal hit-count or "n/m partial" display —
// stitching partial per-shard coverage of the same line into "fully covered"
// would need byte-level re-aggregation through monocart's locator/AST, which
// isn't done here. statements/branches/functions keep real summed counts.
//
// Usage:
//   node misc/merge-coverage-union.js <dir-containing-one-raw-subdir-per-shard>
const fs = require("node:fs");
const path = require("node:path");

// monocart-coverage-reports only exposes "." (plus ./converter, ./util) via
// its package.json "exports" map, so lib/v8/v8.js and lib/reports/
// console-summary.js aren't importable by specifier. Resolving the package's
// real on-disk lib/ dir and requiring by absolute path bypasses that map
// (Node only enforces "exports" for specifier-based resolution).
const mcrLibDir = path.dirname(require.resolve("monocart-coverage-reports"));
const { saveV8Report } = require(path.join(mcrLibDir, "v8", "v8.js"));
const { consoleSummaryReport } = require(path.join(mcrLibDir, "reports", "console-summary.js"));

const downloadsDir = process.argv[2];
if (!downloadsDir) {
  console.error(
    "Usage: node misc/merge-coverage-union.js <dir-containing-one-raw-subdir-per-shard>",
  );
  process.exit(1);
}

function findShardReports(dir) {
  const shardDirs = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name));

  const reportPaths = [];
  for (const shardDir of shardDirs) {
    // Each shard's whole `coverage/` dir (raw/ plus the sibling v8-report.json
    // — see .github/workflows/insomnia-test.yml's "Upload coverage (raw)"
    // step and misc/coverage.ts) is uploaded as the artifact root, so
    // v8-report.json lands directly at the shard's artifact root after
    // download, not under an extra subfolder.
    const candidate = path.join(shardDir, "v8-report.json");
    if (fs.existsSync(candidate)) {
      reportPaths.push(candidate);
    }
  }
  return reportPaths;
}

function loadShardReports(dir) {
  const reportPaths = findShardReports(dir);
  if (!reportPaths.length) {
    console.error(`No shard v8-report.json files found under ${dir}`);
    process.exit(1);
  }
  return reportPaths.map((p) => JSON.parse(fs.readFileSync(p, "utf8")));
}

// Union a list of {start, end, count, ...} ranges (bytes/statements/branches/
// functions) from multiple shards, keyed by (start,end) — identical across
// shards since every shard instruments the exact same build artifact.
// Branches can carry a `none: true` entry (monocart's "no branch taken"
// placeholder) sharing the same start/end as a real branch entry — keep
// those distinct or they collide.
function unionRanges(rangeListsAcrossShards) {
  const byKey = new Map();
  for (const ranges of rangeListsAcrossShards) {
    for (const range of ranges) {
      const key = `${range.start}-${range.end}-${Boolean(range.none)}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += range.count;
      } else {
        byKey.set(key, { ...range });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

// monocart's own per-line `count` value is either a plain number (hit count,
// possibly 0) or a string like "1/2" meaning "partially covered" (a line with
// multiple statements where some but not all are covered) — see
// lib/converter/converter.js's `applyBytesToLines`. A plain `+` across shards
// would silently string-concatenate once a fractional value appears,
// corrupting the result. We don't have enough information here to stitch
// partial coverage from different shards into "fully covered" (that needs
// byte-level reasoning via monocart's locator/AST, not just this flattened
// per-line field), so instead we OR together each shard's own
// fully-covered/not boolean per line, collapsing to a plain 0/1. This
// slightly undercounts lines only covered in pieces across different shards,
// but — unlike the upstream bug — it can only grow as more shards are added,
// never shrink.
function isLineFullyCovered(value) {
  return typeof value === "number" && value > 0;
}

function unionLines(lineMapsAcrossShards) {
  const merged = {};
  for (const lines of lineMapsAcrossShards) {
    for (const [line, value] of Object.entries(lines)) {
      merged[line] = merged[line] || isLineFullyCovered(value) ? 1 : 0;
    }
  }
  return merged;
}

function mergeFiles(shardReports) {
  const bySourcePath = new Map();

  for (const report of shardReports) {
    for (const file of report.files) {
      const key = file.sourcePath;
      if (!bySourcePath.has(key)) {
        bySourcePath.set(key, { first: file, occurrences: [file] });
      } else {
        bySourcePath.get(key).occurrences.push(file);
      }
    }
  }

  const mergedFiles = [];
  for (const [sourcePath, { first, occurrences }] of bySourcePath) {
    const bytes = unionRanges(occurrences.map((f) => f.data.bytes || []));
    const statements = unionRanges(occurrences.map((f) => f.data.statements || []));
    const branches = unionRanges(occurrences.map((f) => f.data.branches || []));
    const functions = unionRanges(occurrences.map((f) => f.data.functions || []));
    const lines = unionLines(occurrences.map((f) => f.data.lines || {}));

    const summarizeRanges = (ranges) => ({
      total: ranges.length,
      covered: ranges.filter((r) => r.count > 0).length,
    });
    const lineValues = Object.values(lines);

    mergedFiles.push({
      url: first.url,
      type: first.type,
      sourcePath,
      id: first.id,
      // identical across shards (same build artifact) — carried over as-is
      source: first.source,
      js: first.js,
      data: { bytes, lines, statements, branches, functions, extras: first.data.extras },
      summary: {
        // `bytes` is recomputed from `data.bytes` + `source` by
        // getV8Summary() inside saveV8Report() below, so it's left out here.
        statements: summarizeRanges(statements),
        branches: summarizeRanges(branches),
        functions: summarizeRanges(functions),
        lines: {
          total: lineValues.length,
          covered: lineValues.filter(Boolean).length,
          blank: first.summary.lines.blank,
          comment: first.summary.lines.comment,
        },
      },
    });
  }

  return mergedFiles;
}

async function main() {
  const shardReports = loadShardReports(downloadsDir);
  console.log(`Loaded ${shardReports.length} shard v8-report.json file(s)`);

  const mergedFiles = mergeFiles(shardReports);

  const outputDir = path.resolve(__dirname, "..", "coverage-merged");
  const name = "Insomnia E2E Coverage";

  // Reuses monocart's own HTML + JSON report renderers — safe here because
  // they only render the `v8list` they're given, with no cross-entry
  // merging of their own (that merging is exactly what we're bypassing).
  const coverageResults = await saveV8Report(mergedFiles, {
    outputDir,
    outputFile: "index.html",
    inline: false,
    assetsPath: "./assets/",
    name,
    reportGroup: new Map([
      ["v8", new Map([["v8", {}], ["v8-json", { outputFile: "coverage-summary.json" }]])],
    ]),
  });

  console.log(`\n[union-merge] ${name} (byte/line/statement/branch/function union across ${shardReports.length} shards)`);
  consoleSummaryReport(coverageResults, {}, {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
