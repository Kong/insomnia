// Merges each shard's `coverage/raw/v8-report.json` (a per-shard, already-correct
// monocart `v8-json` report — see misc/coverage.ts) into one report by taking the
// per-line/statement/branch/function UNION across shards, instead of asking
// monocart-coverage-reports to merge the raw V8 ScriptCov entries itself.
//
// Why: monocart's own multi-run V8 coverage merge (lib/utils/merge/merge.js,
// used by misc/merge-coverage.js) has a bug where merging a script's coverage
// from shards with very different coverage levels can produce a result LOWER
// than any individual shard — a union should only ever grow. Confirmed via a
// minimal repro (same `id`/`sourcePath`, same `total`, but merged `covered`
// line count sits far below the max individual shard's `covered` count, even
// after pre-consolidating each shard's own data before the cross-shard merge).
// Each shard's own report is correct (the bug only triggers on the N-way
// cross-shard merge), so we read those correct per-shard numbers directly and
// union them ourselves at the line/statement/branch/function level, which is
// mathematically exactly "was this covered by any test in the full suite".
//
// Trade-off: the merged `bytes` metric is not reconstructed (would require
// re-deriving non-overlapping byte tilings across shards) and is reported as
// a rough placeholder — rely on lines/statements/branches/functions instead.
//
// Usage:
//   node misc/merge-coverage-union.js <dir-containing-one-raw-subdir-per-shard>
const fs = require('node:fs');
const path = require("node:path");
const consoleGrid = require("console-grid");

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
    // Each shard's whole `coverage/raw/` dir is uploaded as the artifact root
    // (see .github/workflows/insomnia-test.yml's "Upload coverage (raw)"
    // step), so v8-report.json (written to "raw/v8-report.json" relative to
    // coverage.ts's outputDir, i.e. inside that same raw/ dir) lands directly
    // at the shard's artifact root after download, not under an extra
    // subfolder.
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

// Union a list of {start, end, count, ...} ranges (statements/branches/functions)
// from multiple shards, keyed by (start,end) — identical across shards since
// every shard instruments the exact same build artifact. Branches can carry
// a `none: true` entry (monocart's "no branch taken" placeholder) sharing the
// same start/end as a real branch entry — keep those distinct or they collide.
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
// fully-covered/not boolean per line. This slightly undercounts lines only
// covered in pieces across different shards, but — unlike the upstream bug —
// it can only grow as more shards are added, never shrink.
function isLineFullyCovered(value) {
  return typeof value === "number" && value > 0;
}

function unionLines(lineMapsAcrossShards) {
  const merged = {};
  for (const lines of lineMapsAcrossShards) {
    for (const [line, value] of Object.entries(lines)) {
      merged[line] = Boolean(merged[line]) || isLineFullyCovered(value);
    }
  }
  return merged;
}

function summarizeRanges(ranges) {
  const total = ranges.length;
  const covered = ranges.filter((r) => r.count > 0).length;
  return { total, covered };
}

function summarizeLines(dataLines, blank, comment) {
  const lineCoveredFlags = Object.values(dataLines);
  const total = lineCoveredFlags.length;
  const covered = lineCoveredFlags.filter(Boolean).length;
  return { total, covered, blank, comment };
}

function pct(covered, total) {
  if (!total) return 0;
  return Math.round((covered / total) * 10_000) / 100;
}

function mergeFiles(shardReports) {
  const bySourcePath = new Map();

  for (const report of shardReports) {
    for (const file of report.files) {
      const key = file.sourcePath;
      if (!bySourcePath.has(key)) {
        bySourcePath.set(key, { file, occurrences: [file] });
      } else {
        bySourcePath.get(key).occurrences.push(file);
      }
    }
  }

  const mergedFiles = [];
  for (const [sourcePath, { file: first, occurrences }] of bySourcePath) {
    const statements = unionRanges(occurrences.map((f) => f.data.statements || []));
    const branches = unionRanges(occurrences.map((f) => f.data.branches || []));
    const functions = unionRanges(occurrences.map((f) => f.data.functions || []));
    const dataLines = unionLines(occurrences.map((f) => f.data.lines || {}));

    const summary = {
      statements: summarizeRanges(statements),
      branches: summarizeRanges(branches),
      functions: summarizeRanges(functions),
      lines: summarizeLines(
        dataLines,
        first.summary.lines.blank,
        first.summary.lines.comment,
      ),
    };
    for (const key of Object.keys(summary)) {
      summary[key].pct = pct(summary[key].covered, summary[key].total);
    }

    mergedFiles.push({
      url: first.url,
      sourcePath,
      type: first.type,
      summary,
    });
  }

  return mergedFiles;
}

function overallSummary(mergedFiles) {
  const summary = {
    statements: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    lines: { total: 0, covered: 0, blank: 0, comment: 0 },
  };
  for (const file of mergedFiles) {
    for (const key of Object.keys(summary)) {
      summary[key].total += file.summary[key].total;
      summary[key].covered += file.summary[key].covered;
      if (key === "lines") {
        summary[key].blank += file.summary[key].blank;
        summary[key].comment += file.summary[key].comment;
      }
    }
  }
  for (const key of Object.keys(summary)) {
    summary[key].pct = pct(summary[key].covered, summary[key].total);
  }
  return summary;
}

function printConsoleSummary(summary) {
  const rows = ["statements", "branches", "functions", "lines"].map((key) => {
    const s = summary[key];
    return {
      name: key[0].toUpperCase() + key.slice(1),
      pct: `${s.pct.toFixed(2)} %`,
      covered: s.covered,
      uncovered: s.total - s.covered,
      total: s.total,
    };
  });
  consoleGrid({
    columns: [
      { id: "name", name: "Name" },
      { id: "pct", name: "Coverage %" },
      { id: "covered", name: "Covered" },
      { id: "uncovered", name: "Uncovered" },
      { id: "total", name: "Total" },
    ],
    rows,
  });
}

async function main() {
  const shardReports = loadShardReports(downloadsDir);
  console.log(`Loaded ${shardReports.length} shard v8-report.json file(s)`);

  const mergedFiles = mergeFiles(shardReports);
  const summary = overallSummary(mergedFiles);

  const outputDir = path.resolve(__dirname, "..", "coverage-merged");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "coverage-summary.json"),
    JSON.stringify({ summary, files: mergedFiles }, null, 2),
  );

  console.log(`\n[union-merge] Insomnia E2E Coverage (line/statement/branch/function union across ${shardReports.length} shards)`);
  printConsoleSummary(summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
