import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { isPrivateOrLoopbackHost } from './private-host';
import { ALLOWED_EXTENDS_IDENTIFIERS, isLocalFilePath, toArray } from './spectral-ruleset-validator';

// Maximum depth of nested extends to follow when bundling. Guards against deep nesting and cycles.
const MAX_EXTENDS_DEPTH = 5;

const ALLOWED_EXTENSIONS = ['.yaml', '.yml'];

// Abort a remote ruleset fetch that takes longer than this.
const REMOTE_FETCH_TIMEOUT_MS = 10_000;

// `extends` is the only key this file interprets by name. Local-file and remote-URL extends are
// resolved away (flattened in); only built-in spectral identifiers (spectral:oas, …) are carried
// through. Every other top-level key — 'rules', 'aliases', anything added later — flows through the
// generic 'mergeInto' step. This file only flattens: content validation (validateSpectralRuleset —
// rejecting custom "functions" etc.) is a separate concern applied to the fully-flattened output.
type Ruleset = Record<string, unknown> & {
  extends?: string[];
};

// Guards for local-file extends:
// - Excessively deep nesting / cycles
// - Extends that point to non-YAML files
// - Extends that escape the root directory of the originally-selected ruleset
//   (e.g. extends: '../../../etc/secret.yaml'), which could exfiltrate arbitrary
//   .yaml files on the user's disk via the bundled output returned to the renderer.
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

// Reads and parses a local ruleset file.
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
// Non-object values are overridden by "source" if present, otherwise left as-is from "target".
function mergeInto(target: Ruleset, source: Ruleset): void {
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    target[key] = isPlainObject(targetVal) && isPlainObject(sourceVal) ? { ...targetVal, ...sourceVal } : sourceVal;
  }
}

// Parses an "extends" entry into a URL. `base` resolves relative entries within a remote ruleset.
function parseRemoteExtendsUrl(entry: string, base?: URL): URL {
  try {
    return new URL(entry, base);
  } catch {
    throw new Error(`"extends" entry "${entry}" is not a valid spectral identifier, local path, or URL.`);
  }
}

// SSRF guard: a remote "extends" URL must be https and resolve only to public addresses.
async function assertSafeRemoteUrl(url: URL): Promise<void> {
  if (url.protocol !== 'https:') {
    throw new Error(`Remote "extends" URL must use https: ${url.href}`);
  }
  const hostname = url.hostname.toLowerCase();
  if (!hostname || isPrivateOrLoopbackHost(hostname)) {
    throw new Error(`Remote "extends" URL targets a disallowed host: ${url.href}`);
  }
  // The literal hostname can still resolve to an internal address (e.g. *.localtest.me → 127.0.0.1).
  const records = await dns.lookup(hostname, { all: true });
  for (const { address } of records) {
    if (isPrivateOrLoopbackHost(address.toLowerCase())) {
      throw new Error(`Failed to resolve host. "${url.href}" resolves to a private or loopback address.`);
    }
  }
}

// Fetches a remote ruleset over the network (SSRF-guarded) and parses it. Content validation —
// rejecting custom "functions" and other disallowed keys — is intentionally NOT done here:
// bundling only flattens, and mergeInto carries every key into the output, so the single
// downstream validation pass still catches anything a remote ruleset tried to introduce.
async function readRemoteRuleset(url: URL): Promise<Ruleset> {
  await assertSafeRemoteUrl(url);

  let response: Response;
  try {
    // redirect: 'error' — a redirect could send us to an unvalidated (internal) host.
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch remote "extends" ruleset "${url.href}": ${reason}`);
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch remote "extends" ruleset "${url.href}": ${response.status} ${response.statusText}`,
    );
  }

  const parsed = YAML.parse(await response.text());
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Remote "extends" ruleset "${url.href}" must be an object at the top level.`);
  }
  return parsed as Ruleset;
}

// Recursively resolves a remote-URL "extends" into a flattened ruleset. Within a remote ruleset
// every non-identifier "extends" entry is itself a URL (relative entries resolve against `url`) —
// there are no local files on the user's disk here, so this path only ever fetches over the network.
async function flattenRemoteRuleset(url: URL, visited: Set<string>, depth: number): Promise<Ruleset> {
  if (depth > MAX_EXTENDS_DEPTH) {
    throw new Error(`"extends" nested too deeply (max ${MAX_EXTENDS_DEPTH}) at ${url.href}`);
  }
  if (visited.has(url.href)) {
    throw new Error(`"extends" cycle detected at ${url.href}`);
  }

  const ruleset = await readRemoteRuleset(url);
  const nextVisited = new Set(visited).add(url.href);

  const flattenedRuleset: Ruleset = {};
  const remainingExtends: string[] = [];

  for (const entry of toArray(ruleset.extends)) {
    if (Array.isArray(entry)) {
      throw new TypeError(
        `Failed to process "extends" entry ${JSON.stringify(entry)}: tuple format (e.g. [path, severity]) is not supported. Use a plain string instead.`,
      );
    }
    // Built-in spectral identifiers are resolved locally by Spectral; carry them through.
    if (ALLOWED_EXTENDS_IDENTIFIERS.includes(entry)) {
      remainingExtends.push(entry);
      continue;
    }
    const childRuleset = await flattenRemoteRuleset(parseRemoteExtendsUrl(entry, url), nextVisited, depth + 1);
    if (childRuleset.extends) {
      remainingExtends.push(...childRuleset.extends);
    }
    mergeInto(flattenedRuleset, childRuleset);
  }

  const parentOverrides: Ruleset = { ...ruleset };
  delete parentOverrides.extends;
  mergeInto(flattenedRuleset, parentOverrides);

  const uniqueExtends = [...new Set(remainingExtends)];
  delete flattenedRuleset.extends;
  return uniqueExtends.length > 0 ? { extends: uniqueExtends, ...flattenedRuleset } : flattenedRuleset;
}

// Recursively resolves "extends" entries into a single ruleset. Local-file extends are always
// flattened. Remote-URL extends are flattened only when `resolveRemote` is true — otherwise they
// are left untouched in "extends" to be resolved later. Rules are merged such that the parent
// overrides its extends, and among multiple extends entries later ones override earlier.
// (ref: https://docs.stoplight.io/docs/spectral/83527ef2dd8c0-extending-rulesets)
async function flattenRuleset(
  filePath: string,
  visited: Set<string>,
  depth: number,
  rootDir: string,
  resolveRemote: boolean,
): Promise<Ruleset> {
  const absolute = path.resolve(filePath);
  assertAllowed(absolute, visited, depth, rootDir);

  const ruleset = await readRuleset(absolute);
  const baseDir = path.dirname(absolute);
  const nextVisited = new Set(visited).add(absolute);

  const flattenedRuleset: Ruleset = {}; // Flattened ruleset containing all rules within this file and its extends.
  const remainingExtends: string[] = []; // built-in spectral identifiers, plus remote URLs when resolveRemote is false.

  for (const entry of toArray(ruleset.extends)) {
    if (Array.isArray(entry)) {
      throw new TypeError(
        `Failed to process "extends" entry ${JSON.stringify(entry)}: tuple format (e.g. [path, severity]) is not supported. Use a plain string instead.`,
      );
    }
    // Built-in spectral identifiers (spectral:oas, …) — Spectral resolves these locally; carry through.
    if (ALLOWED_EXTENDS_IDENTIFIERS.includes(entry)) {
      remainingExtends.push(entry);
      continue;
    }
    // Remote URL extends.
    if (!isLocalFilePath(entry)) {
      if (!resolveRemote) {
        // Leave remote URLs in place — they are flattened later, at lint time, against the
        // current remote ruleset (which may have changed since the ruleset was selected).
        remainingExtends.push(entry);
        continue;
      }
      const remoteRuleset = await flattenRemoteRuleset(parseRemoteExtendsUrl(entry), nextVisited, depth + 1);
      if (remoteRuleset.extends) {
        remainingExtends.push(...remoteRuleset.extends);
      }
      mergeInto(flattenedRuleset, remoteRuleset);
      continue;
    }
    // Local file paths are recursively loaded and flattened.
    const childRuleset = await flattenRuleset(
      path.resolve(baseDir, entry),
      nextVisited,
      depth + 1,
      rootDir,
      resolveRemote,
    );
    if (childRuleset.extends) {
      remainingExtends.push(...childRuleset.extends);
    }
    mergeInto(flattenedRuleset, childRuleset); // child takes precedence over parent
  }

  // Apply the current file's own rules on top; if parent and child define the same rule, the parent wins.
  const parentOverrides: Ruleset = { ...ruleset };
  delete parentOverrides.extends;
  mergeInto(flattenedRuleset, parentOverrides);

  // Local-file extends have been flattened in. What remains in "extends" is built-in spectral
  // identifiers, plus remote URLs when resolveRemote is false. Remove duplicates, preserving order.
  const uniqueExtends = [...new Set(remainingExtends)];
  delete flattenedRuleset.extends;
  return uniqueExtends.length > 0 ? { extends: uniqueExtends, ...flattenedRuleset } : flattenedRuleset;
}

// Flattens a ruleset's "extends" into a single self-contained ruleset.
// - resolveRemote: false — flatten local-file extends only (used at file-selection time, the only
//   moment the user's sibling files are reachable). Remote URLs are left in "extends".
// - resolveRemote: true — also fetch and flatten remote-URL extends (used at lint time, against
//   the current remote ruleset, before the output is validated and handed to Spectral).
export async function bundleSpectralRuleset(sourcePath: string, options: { resolveRemote: boolean }): Promise<string> {
  const rootDir = path.dirname(path.resolve(sourcePath));
  const flattenedRuleset = await flattenRuleset(sourcePath, new Set(), 0, rootDir, options.resolveRemote);
  return YAML.stringify(flattenedRuleset);
}
