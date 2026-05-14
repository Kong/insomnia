import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { isLocalFilePath, toArray } from '~/common/spectral-ruleset-validator';

// Maximum depth of nested extends to follow when bundling. Guards against deep nesting and cycles.
const MAX_EXTENDS_DEPTH = 5;

const ALLOWED_EXTENSIONS = ['.yaml', '.yml'];

// `extends` is the only key we touch by name in this file: local paths get resolved away and
// remote/built-in entries are carried through. Every other top-level key — `rules`, `aliases`,
// `parserOptions`, anything we may add later — flows through the generic `mergeInto` step.
// The validator that runs after bundling decides which keys are actually allowed.
type Ruleset = Record<string, unknown> & {
  extends?: string[];
};

// Prevents the below
// - Excessively deep nesting of extends (e.g. A extends B extends C extends D extends E extends F)
// - Cycles in extends (e.g. A extends B extends A)
// - Extends that point to non-YAML files (e.g. A extends B.txt)
function assertAllowed(absolute: string, visited: Set<string>, depth: number): void {
  if (depth > MAX_EXTENDS_DEPTH) {
    throw new Error(`"extends" nested too deeply (max ${MAX_EXTENDS_DEPTH}) at ${absolute}`);
  }
  if (visited.has(absolute)) {
    throw new Error(`"extends" cycle detected at ${absolute}`);
  }
  if (!ALLOWED_EXTENSIONS.includes(path.extname(absolute).toLowerCase())) {
    throw new Error(`"extends" target must be a .yaml or .yml file: ${absolute}`);
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
async function flattenRuleset(filePath: string, visited: Set<string>, depth: number): Promise<Ruleset> {
  const absolute = path.resolve(filePath);
  assertAllowed(absolute, visited, depth);

  const ruleset = await readRuleset(absolute);
  const baseDir = path.dirname(absolute);
  const nextVisited = new Set(visited).add(absolute);

  const flattenedRuleset: Ruleset = {}; // Flattended ruleset containing all rules within this file path and its local extends
  const remainingExtends: string[] = []; // non local file paths — built-in identifiers and remote URLs; deduped at return

  // Resolve 'extends' first: recurse on local file paths and merge each flattened child into 'flattenedRuleset',
  // Collect any non-local entries (built-in identifiers, https URLs) for the final 'extends'.
  for (const entry of toArray(ruleset.extends)) {
    // Keep built-in rulesets and remote URLs.
    if (!isLocalFilePath(entry)) {
      remainingExtends.push(entry);
      continue;
    }
    // flatten local rulesets
    const childRuleset = await flattenRuleset(path.resolve(baseDir, entry), nextVisited, depth + 1);
    if (childRuleset.extends) {
      remainingExtends.push(...childRuleset.extends);
    }

    mergeInto(flattenedRuleset, childRuleset); // merge child's rules and other keys into the flattenedRuleset, with child taking precedence over parent
  }

  // Now layer the parent ruleset over the inherited values (parent wins on collisions).
  // We exclude the parent's 'extends' from this step — its local paths have already been
  // resolved in the loop above, and the final value lives in 'remainingExtends'.
  const parentOverrides: Ruleset = { ...ruleset };
  delete parentOverrides.extends;
  mergeInto(flattenedRuleset, parentOverrides);

  // The parent's own 'extends' is already represented in 'remainingExtends' (resolved or carried).
  // Remove duplicates while preserving order, and return the final flattened ruleset with a consolidated 'extends' array containing only built-in identifiers and remote URLs.
  const uniqueExtends = [...new Set(remainingExtends)];
  delete flattenedRuleset.extends;
  return uniqueExtends.length > 0 ? { extends: uniqueExtends, ...flattenedRuleset } : flattenedRuleset;
}

export async function bundleSpectralRuleset(sourcePath: string): Promise<string> {
  const flattenedRuleset = await flattenRuleset(sourcePath, new Set(), 0);
  return YAML.stringify(flattenedRuleset);
}
