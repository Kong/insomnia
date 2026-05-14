import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { isLocalFilePath, toArray } from '~/common/spectral-ruleset-validator';

// Maximum depth of nested extends to follow when bundling. Guards against pathological or cyclical rulesets.
const MAX_EXTENDS_DEPTH = 5;

const ALLOWED_EXTENSIONS = ['.yaml', '.yml'];

// we only allow rulesets that contain extends and/or rules for the time being
interface Ruleset {
  extends?: string[];
  rules?: Record<string, unknown>;
}

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

// reads and parses a ruleset file
async function readRuleset(absolute: string): Promise<Record<string, unknown>> {
  const raw = await fs.promises.readFile(absolute, { encoding: 'utf-8' });
  const parsed = YAML.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Ruleset at ${absolute} must be an object at the top level.`);
  }
  return parsed as Record<string, unknown>;
}

function pushUnique<T>(list: T[], value: T): void {
  if (!list.includes(value)) {
    list.push(value);
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

  const inheritedRules: Record<string, unknown> = {};
  const remainingExtends: string[] = [];

  for (const entry of toArray(ruleset.extends)) {
    if (typeof entry !== 'string') {
      throw new TypeError(`"extends" entries must be strings (in ${absolute}).`);
    }

    if (!isLocalFilePath(entry)) {
      pushUnique(remainingExtends, entry);
      continue;
    }

    const child = await flattenRuleset(path.resolve(baseDir, entry), nextVisited, depth + 1);
    child.extends?.forEach(childEntry => pushUnique(remainingExtends, childEntry));
    Object.assign(inheritedRules, child.rules ?? {});
  }

  const mergedRules = { ...inheritedRules, ...((ruleset.rules ?? {}) as Record<string, unknown>) };

  return {
    ...(remainingExtends.length > 0 && { extends: remainingExtends }),
    ...(Object.keys(mergedRules).length > 0 && { rules: mergedRules }),
  };
}

export async function bundleSpectralRuleset(sourcePath: string): Promise<string> {
  const flattened = await flattenRuleset(sourcePath, new Set(), 0);
  return YAML.stringify(flattened);
}
