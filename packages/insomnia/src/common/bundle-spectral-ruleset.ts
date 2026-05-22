import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { isLocalFilePath, toArray } from '~/common/spectral-ruleset-validator';

// Maximum depth of nested extends to follow when bundling. Guards against deep nesting and cycles.
const MAX_EXTENDS_DEPTH = 5;

const ALLOWED_EXTENSIONS = ['.yaml', '.yml'];

// `extends` is the only key we touch by name in this file: local paths get resolved away and
// remote URLs and spectral identifier entries are carried through. Every other top-level key — 'rules', 'aliases',
// 'parserOptions', anything we may add later — flows through the generic 'mergeInto' step.
// The validator that runs after bundling (ref: spectral-ruleset-validator.ts) decides which keys are actually allowed and all of the constraints.
type Ruleset = Record<string, unknown> & {
  extends?: string[];
};

// Prevents the below
// - Excessively deep nesting of extends (e.g. A extends B extends C extends D extends E extends F)
// - Cycles in extends (e.g. A extends B extends A)
// - Extends that point to non-YAML files (e.g. A extends B.txt)
// - Extends that escape the root directory of the originally-selected ruleset
//   (e.g. extends: '../../../etc/secret.yaml'). Without this, a malicious or
//   shared ruleset could exfiltrate arbitrary .yaml files on the user's disk
//   via the bundled output returned to the renderer.
function assertAllowed(absolute: string, visited: Set<string>, depth: number, rootDir: string): void {
  if (depth > MAX_EXTENDS_DEPTH) {
    throw new Error(`"extends" nested too deeply (max ${MAX_EXTENDS_DEPTH}) at ${absolute}`);
  }
  if (visited.has(absolute)) {
    throw new Error(`"extends" cycle detected at ${absolute}`);
  }
  if (!ALLOWED_EXTENSIONS.includes(path.extname(absolute).toLowerCase())) {
    throw new Error(`"extends" target must be a .yaml or .yml file: ${absolute}`);
  }
  const rel = path.relative(rootDir, absolute);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`"extends" target must stay within the ruleset's root directory: ${absolute}`);
  }
}

// Reads and parses a ruleset file
async function readRuleset(absolute: string): Promise<Ruleset> {
  const raw = await fs.promises.readFile(absolute, { encoding: 'utf8' });
  const parsed = YAML.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Ruleset at ${absolute} must be an object at the top level.`);
  }
  return parsed as Ruleset;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// One level deep merge for top-level spectral keys.
// Object values are merged shallowly (e.g. rules) with "source" taking precedence over "target".
// Non-object values (e.g. extends ) are overridden by "source" if they exist, otherwise left as-is from "target".
function mergeInto(target: Ruleset, source: Ruleset): void {
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    target[key] = isPlainObject(targetVal) && isPlainObject(sourceVal) ? { ...targetVal, ...sourceVal } : sourceVal;
  }
}

// Recursively resolves local-file "extends" entries, returning a singular ruleset whose "extends"
// contains only built-in spectral identifiers and remote URLs. Rules are merged such that the parent overrides
// its extends, and among multiple extends entries the later ones override earlier. (ref: https://docs.stoplight.io/docs/spectral/83527ef2dd8c0-extending-rulesets)
async function flattenRuleset(
  filePath: string,
  visited: Set<string>,
  depth: number,
  rootDir: string,
): Promise<Ruleset> {
  const absolute = path.resolve(filePath);
  assertAllowed(absolute, visited, depth, rootDir);

  const ruleset = await readRuleset(absolute);
  const baseDir = path.dirname(absolute);
  const nextVisited = new Set(visited).add(absolute);

  const flattenedRuleset: Ruleset = {}; // Flattended ruleset containing all rules within this file path and its local extends
  const remainingExtends: string[] = []; // non local file paths — built-in identifiers and remote URLs

  // Process everything listed in "extends".
  //
  // For local file paths:
  //   - recursively load and flatten them
  //   - merge their rules into the current result
  //
  // For non-local entries (built in identifiers / remote URLs):
  //   - keep them in a separate list
  //   - include them later in the final "extends" array
  for (const entry of toArray(ruleset.extends)) {
    if (Array.isArray(entry)) {
      throw new TypeError(
        `Failed to process "extends" entry ${JSON.stringify(entry)}: tuple format (e.g. [path, severity]) is not supported. Use a plain string instead.`,
      );
    }
    // If this entry is NOT a local file path,
    // keep it as-is for the final output.
    if (!isLocalFilePath(entry)) {
      remainingExtends.push(entry);
      continue;
    }
    // Local file paths are recursively loaded and flattened.
    const childRuleset = await flattenRuleset(path.resolve(baseDir, entry), nextVisited, depth + 1, rootDir);
    if (childRuleset.extends) {
      remainingExtends.push(...childRuleset.extends);
    }

    mergeInto(flattenedRuleset, childRuleset); // merge child's rules and other keys into the flattenedRuleset, with child taking precedence over parent
  }

  // After all inherited rulesets are merged,
  // apply the current file's own rules on top.
  //
  // If parent and child define the same rule,
  // the parent value wins.
  //
  // Do NOT merge the parent's "extends" field here,
  // because:
  //   - local file paths were already flattened above
  //   - non-local entries are already stored in "remainingExtends"
  const parentOverrides: Ruleset = { ...ruleset };
  delete parentOverrides.extends;
  mergeInto(flattenedRuleset, parentOverrides);

  // At this point:
  //   - all local file-based "extends" have been flattened
  //   - only built-in spectral identifiers and remote URLs remain
  //
  // Remove duplicate entries while preserving order,
  // then return the final flattened ruleset.
  const uniqueExtends = [...new Set(remainingExtends)];
  delete flattenedRuleset.extends;
  return uniqueExtends.length > 0 ? { extends: uniqueExtends, ...flattenedRuleset } : flattenedRuleset;
}

export async function bundleSpectralRuleset(sourcePath: string): Promise<string> {
  const rootDir = path.dirname(path.resolve(sourcePath));
  const flattenedRuleset = await flattenRuleset(sourcePath, new Set(), 0, rootDir);
  return YAML.stringify(flattenedRuleset);
}
