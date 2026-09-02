#!/usr/bin/env node
/* global process, console */
// Runs dependency-cruiser per workspace package to find circular imports, and fails only on
// cycles that are not already recorded in the baseline file. Run with --update-baseline to
// regenerate the baseline from the current state (e.g. after fixing a cycle).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const depcruiseBin = path.join(repoRoot, 'node_modules', '.bin', 'depcruise');
const configPath = path.join(repoRoot, '.dependency-cruiser.json');
const baselinePath = path.join(repoRoot, '.dependency-cruiser-known-violations.json');

// Same scope as `npm run lint`/`type-check`/`test` (--workspaces --if-present): the packages
// actually declared as npm workspaces, not every directory under packages/ (e.g.
// insomnia-component-docs is intentionally excluded and its deps aren't installed at the root).
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const packageDirs = rootPackageJson.workspaces
  .map(workspace => ({ name: path.basename(workspace), dir: path.join(repoRoot, workspace) }))
  .sort((a, b) => a.name.localeCompare(b.name));
const packageNames = packageDirs.map(({ name }) => name);

function packageForAbsPath(absPath) {
  const found = packageDirs.find(({ dir }) => absPath === dir || absPath.startsWith(dir + path.sep));
  return found ? found.name : null;
}

// Rotates a cycle's node list to start at its lexicographically smallest entry, so the same
// logical cycle reported starting from different nodes (which dependency-cruiser does) collapses
// to one canonical key.
function canonicalize(repoRelNodes) {
  let minIndex = 0;
  for (let i = 1; i < repoRelNodes.length; i++) {
    if (repoRelNodes[i] < repoRelNodes[minIndex]) minIndex = i;
  }
  return [...repoRelNodes.slice(minIndex), ...repoRelNodes.slice(0, minIndex)].join(' -> ');
}

function cruisePackage({ name, dir }) {
  const tsconfigPath = path.join(dir, 'tsconfig.json');
  const args = ['--config', configPath];
  if (fs.existsSync(tsconfigPath)) args.push('--ts-config', 'tsconfig.json');
  // Exclude node_modules and any local build/dist output (untracked, non-reproducible artifacts
  // from a prior local build) at any depth, e.g. packages/insomnia/build/.
  args.push('-x', 'node_modules|(^|/)(build|dist)(/|$)', '--output-type', 'json', '.');

  const stdout = execFileSync(depcruiseBin, args, { cwd: dir, encoding: 'utf8', maxBuffer: 1024 * 1024 * 100 });
  const result = JSON.parse(stdout);

  // key: canonical signature -> Set of packages it touches
  const cycles = new Map();
  for (const violation of result.summary.violations) {
    if (violation.type !== 'cycle') continue;
    // A cycle needs >=2 distinct modules; length-1 "cycles" are resolver artifacts (e.g. a bare
    // specifier like `esbuild` misresolved to a same-named local file `esbuild.ts`), not real
    // circular dependencies.
    if (violation.cycle.length <= 1) continue;
    const repoRelNodes = violation.cycle.map(node => {
      const abs = path.resolve(dir, node.name);
      return path.relative(repoRoot, abs).split(path.sep).join('/');
    });
    const key = canonicalize(repoRelNodes);
    if (cycles.has(key)) continue;
    const attributed = new Set(repoRelNodes.map(p => packageForAbsPath(path.resolve(repoRoot, p))).filter(Boolean));
    cycles.set(key, attributed);
  }
  return cycles;
}

function cruiseAll() {
  // packageName -> Set<canonical key>
  const byPackage = new Map(packageNames.map(name => [name, new Set()]));
  for (const pkg of packageDirs) {
    const cycles = cruisePackage(pkg);
    for (const [key, attributed] of cycles) {
      for (const pkgName of attributed) {
        byPackage.get(pkgName).add(key);
      }
    }
  }
  return byPackage;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return new Map();
  const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  return new Map(Object.entries(raw).map(([name, keys]) => [name, new Set(keys)]));
}

function writeBaseline(byPackage) {
  const raw = {};
  for (const name of packageNames) {
    raw[name] = [...byPackage.get(name)].sort();
  }
  fs.writeFileSync(baselinePath, JSON.stringify(raw, null, 2) + '\n');
}

function main() {
  const updateBaseline = process.argv.includes('--update-baseline');
  const current = cruiseAll();

  if (updateBaseline) {
    writeBaseline(current);
    const total = [...current.values()].reduce((sum, set) => sum + set.size, 0);
    console.log(`Baseline updated: ${baselinePath} (${total} cycle attributions across ${packageNames.length} packages)`);
    return;
  }

  const baseline = readBaseline();
  let hasNew = false;
  for (const name of packageNames) {
    const currentKeys = current.get(name);
    const baselineKeys = baseline.get(name) || new Set();
    const newKeys = [...currentKeys].filter(key => !baselineKeys.has(key));
    console.log(`${name}: ${currentKeys.size} cycle(s)${newKeys.length ? `, ${newKeys.length} NEW` : ''}`);
    if (newKeys.length) {
      hasNew = true;
      for (const key of newKeys) {
        console.log(`  NEW: ${key}`);
      }
    }
  }

  if (hasNew) {
    console.log('\nNew circular dependencies detected that are not in the baseline.');
    console.log(`If intentional/unavoidable, run "npm run check-cycle-references:baseline" and commit the updated ${path.basename(baselinePath)}.`);
    process.exit(1);
  }
  console.log('\nNo new circular dependencies.');
}

main();
