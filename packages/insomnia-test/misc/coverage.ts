import * as fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { extractFile } from "@electron/asar";
import type { Page } from "@playwright/test";
import { CoverageReport } from "monocart-coverage-reports";

/**
 * Off by default — instrumenting/collecting V8 coverage on every window and
 * Electron main process adds real per-test overhead, so it's opt-in via
 * `COVERAGE=true` (see `.github/workflows/insomnia-test.yml` for the CI job
 * that turns it on).
 */
export const COVERAGE_ENABLED = process.env.COVERAGE === "true";

const OUTPUT_DIR = path.resolve(__dirname, "..", "coverage");

/**
 * Where the Electron main process's `NODE_V8_COVERAGE` output lands. Nested
 * inside `OUTPUT_DIR` (rather than a sibling dir) so the existing repo-wide
 * `coverage` gitignore rule covers it for free, and so MCR's own
 * clean/cleanCache handling — which already special-cases whatever
 * directory `NODE_V8_COVERAGE` points at — leaves it alone.
 */
export const NODE_COVERAGE_DIR = path.join(OUTPUT_DIR, "node-raw");

let report: InstanceType<typeof CoverageReport> | undefined;

/**
 * A single `CoverageReport` per process, all pointed at the same
 * `OUTPUT_DIR` — MCR persists every `.add()` call to `OUTPUT_DIR/.cache` on
 * disk, so worker processes (which collect coverage) and the main
 * orchestrator process (which runs `globalSetup`/`globalTeardown`) share
 * state across the process boundary without anything extra.
 */
function getReport() {
  if (!report) {
    report = new CoverageReport({
      name: "Insomnia E2E Coverage",
      outputDir: OUTPUT_DIR,
      dataDir: NODE_COVERAGE_DIR,
      entryFilter: {
        "**/node_modules/**": false,
        "**/*": true,
      },
      // `entryFilter` only sees the bundled script URLs, so it can't drop
      // third-party code that was bundled into the app's own scripts. Once
      // sourcemaps are resolved, this filters on the original source paths.
      sourceFilter: {
        "**/node_modules/**": false,
        "**/*": true,
      },
      reports: [
        // Raw merged coverage data — the only thing a sharded CI run needs
        // to upload per-shard; the final report job merges these together
        // (see `misc/merge-coverage.ts`).
        ["raw", { outputDir: "raw" }],
        // This shard's own already-correct per-file summary (monocart's
        // multi-shard merge of raw V8 coverage has a bug where merging a
        // script's coverage across shards with very different coverage
        // levels can produce a result *lower* than any individual shard —
        // see `misc/merge-coverage-union.js`, which reads this file from
        // every shard and unions them itself instead of relying on that
        // merge). Must NOT be written inside the "raw" report's own
        // `raw/` output dir: that report unconditionally deletes and
        // regenerates its whole directory on every run, and (per monocart's
        // fixed report-group ordering) always runs after `v8-json` — so
        // anything written under `raw/` here gets silently wiped. Written as
        // a sibling of `raw/` instead; the CI upload step picks up both.
        ["v8-json", { outputFile: "v8-report.json" }],
        // A self-contained interactive report for local runs / the final
        // merged CI artifact.
        ["v8"],
        "console-summary",
      ],
    });
  }
  return report;
}

/** Cleans stale `.cache` data left over from a previous run — call once, before any test runs (see `misc/coverage-global-setup.ts`). */
export function resetCoverageCache(): void {
  if (!COVERAGE_ENABLED) {
    return;
  }
  getReport().cleanCache();
  fs.rmSync(NODE_COVERAGE_DIR, { recursive: true, force: true });
}

/** Env vars to add to `electron.launch()` so the main process's own V8 coverage gets recorded — a no-op object when coverage is disabled. */
export function coverageLaunchEnv(): Record<string, string> {
  if (!COVERAGE_ENABLED) {
    return {};
  }
  fs.mkdirSync(NODE_COVERAGE_DIR, { recursive: true });
  return { NODE_V8_COVERAGE: NODE_COVERAGE_DIR };
}

const APP_ORIGIN = "https://insomnia-app.local/";

/**
 * Renderer scripts are served through Electron's custom `https://insomnia-app.local`
 * protocol (see `api.protocol.ts` in the app), which monocart can't fetch, so
 * the `//# sourceMappingURL=` comment never resolves and the report falls back
 * to the compiled bundles. Read the `.map` from the packaged app (or the dev
 * build dir) ourselves and hand it over via `entry.sourceMap` instead.
 */
function loadRendererSourceMap(entryUrl: string): object | undefined {
  if (!entryUrl.startsWith(`${APP_ORIGIN}assets/`)) {
    return undefined;
  }
  const relPath = `client/${entryUrl.slice(APP_ORIGIN.length).split(/[?#]/)[0]}.map`;
  const binary = process.env.INSOMNIA_BINARY;
  const asarCandidates = binary
    ? [
        path.join(path.dirname(binary), "resources", "app.asar"), // linux/windows
        path.join(path.dirname(binary), "..", "Resources", "app.asar"), // macOS
      ]
    : [];
  for (const asarPath of asarCandidates) {
    try {
      if (fs.existsSync(asarPath)) {
        return JSON.parse(extractFile(asarPath, relPath).toString("utf8"));
      }
    } catch {
      // map not packaged — fall through
    }
  }
  // Dev mode / unpackaged build output
  const devMap = path.resolve(__dirname, "..", "..", "insomnia", "build", relPath);
  try {
    return JSON.parse(fs.readFileSync(devMap, "utf8"));
  } catch {
    return undefined;
  }
}

/** Starts JS coverage collection on a renderer window — pair with `collectWindowCoverage()` before the window closes. */
export async function startWindowCoverage(win: Page): Promise<void> {
  if (!COVERAGE_ENABLED) {
    return;
  }
  await win.coverage
    .startJSCoverage({ resetOnNavigation: false })
    .catch(() => {
      // Window may already be mid-navigation/closing — coverage for it is
      // best-effort, never worth failing a test over.
    });
}

/** Stops JS coverage collection on a renderer window and folds it into the shared report. */
export async function collectWindowCoverage(win: Page): Promise<void> {
  if (!COVERAGE_ENABLED) {
    return;
  }
  try {
    const jsCoverage = await win.coverage.stopJSCoverage();
    // Drop entries from devtools extensions (e.g. React Developer Tools,
    // loaded as `chrome-extension://...`) — not app code, and MCR's
    // sourcemap resolver only handles http(s)/file URLs.
    const appCoverage = jsCoverage.filter((entry) =>
      /^(https?|file):/.test(entry.url),
    );
    for (const entry of appCoverage) {
      const sourceMap = loadRendererSourceMap(entry.url);
      if (sourceMap) {
        (entry as { sourceMap?: object }).sourceMap = sourceMap;
      }
    }
    if (appCoverage.length) {
      await getReport().add(appCoverage);
    }
  } catch {
    // Window already closed (e.g. after `AppFlow.restart()` tore down the
    // previous one) — nothing left to collect.
  }
}

/**
 * The packaged app's main-process bundles live inside `app.asar`, which plain
 * Node (where monocart runs) can't `fs.readFileSync` into — so monocart finds
 * no source for those scripts and silently drops them from the report. Before
 * generating, pull each such script's source (and its `.map`) out of the asar
 * ourselves: sources go in `source-*.json` files and maps into the coverage
 * file's `source-map-cache`, both of which monocart's `dataDir` reader already
 * understands.
 */
function prepareAsarMainCoverage(): void {
  if (!fs.existsSync(NODE_COVERAGE_DIR)) {
    return;
  }
  const seen = new Set<string>();
  for (const filename of fs.readdirSync(NODE_COVERAGE_DIR)) {
    if (!filename.endsWith(".json") || filename.startsWith("source-")) {
      continue;
    }
    const filePath = path.join(NODE_COVERAGE_DIR, filename);
    let json: {
      result?: { url?: string }[];
      "source-map-cache"?: Record<string, { data?: unknown }>;
    };
    try {
      json = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(json.result)) {
      continue;
    }
    let changed = false;
    for (const { url } of json.result) {
      if (!url?.startsWith("file:")) {
        continue;
      }
      const scriptPath = fileURLToPath(url);
      const asarIndex = scriptPath.indexOf(".asar/");
      if (asarIndex === -1 || scriptPath.includes("node_modules")) {
        continue;
      }
      const asarPath = scriptPath.slice(0, asarIndex + ".asar".length);
      const innerPath = scriptPath.slice(asarIndex + ".asar/".length);
      try {
        if (!seen.has(url)) {
          seen.add(url);
          const source = extractFile(asarPath, innerPath).toString("utf8");
          fs.writeFileSync(
            path.join(NODE_COVERAGE_DIR, `source-asar-${seen.size}.json`),
            JSON.stringify({ url, source }),
          );
        }
        const cache = (json["source-map-cache"] ??= {});
        if (!cache[url]?.data) {
          const map = JSON.parse(
            extractFile(asarPath, `${innerPath}.map`).toString("utf8"),
          );
          cache[url] = { ...cache[url], data: map };
          changed = true;
        }
      } catch {
        // script or map not in the asar — monocart skips it as before
      }
    }
    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(json));
    }
  }
}

/** Generates the merged report from every window's/every Electron main process's coverage collected so far — call once, after all tests finish (see `misc/coverage-global-teardown.ts`). */
export async function generateCoverageReport(): Promise<void> {
  if (!COVERAGE_ENABLED) {
    return;
  }
  prepareAsarMainCoverage();
  await getReport().generate();
}
