import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';

import YAML from 'yaml';

import { isPrivateOrLoopbackHost } from './private-host';
import { ALLOWED_EXTENDS_IDENTIFIERS, toArray, validateSpectralRuleset } from './spectral-ruleset-validator';

const MAX_EXTENDS_DEPTH = 5;

const ALLOWED_EXTENSIONS = ['.yaml', '.yml'];

const REMOTE_FETCH_TIMEOUT_MS = 10_000;

// Represents a parsed Spectral ruleset object. Every top-level key other than
// "extends" is treated as opaque data and passed through unchanged.
type Ruleset = Record<string, unknown> & {
  extends?: string[];
};

// Safety checks for local-file extends entries:
// - Depth / cycle guard against infinite recursion.
// - Extension check ensures we only load YAML files.
// - rootDir guard prevents path traversal (e.g. '../../../etc/passwd') from
//   reaching files outside the directory of the originally-selected ruleset.
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

// Reads a local ruleset file from disk and parses it.
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

// Shallow-merges top-level keys from source into target.
// Object values (e.g. "rules") are merged one level deep with source taking precedence.
// Scalar values are overwritten by source.
function mergeInto(target: Ruleset, source: Ruleset): void {
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    target[key] = isPlainObject(targetVal) && isPlainObject(sourceVal) ? { ...targetVal, ...sourceVal } : sourceVal;
  }
}

// Resolves an "extends" entry into a URL. When `base` is provided, relative paths are
// resolved against it — used when processing extends entries inside a remote ruleset.
function parseRemoteExtendsUrl(entry: string, base?: URL): URL {
  try {
    return new URL(entry, base);
  } catch {
    throw new Error(`"extends" entry "${entry}" is not a valid spectral identifier, local path, or URL.`);
  }
}

// Rejects URLs that could be used for SSRF attacks:
// - Must be https (no http, ftp, file, etc.)
// - Hostname must not be a known private/loopback address
// - DNS resolution must not yield a private/loopback address
async function assertSafeRemoteUrl(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') {
    throw new Error(`Remote "extends" URL ${url.href} must use https`);
  }
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

// Fetches and parses a remote ruleset over the network. The URL is SSRF-checked before
// any network call is made. Redirects are rejected because a redirect could forward us
// to an internal host that bypassed the assertSafeRemoteUrl check.
async function readRemoteRuleset(url: URL): Promise<Ruleset> {
  await assertSafeRemoteUrl(url);

  let response: Response;
  try {
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

// Validates a remote "extends" URL and all its children.
// For each URL in the chain: fetches the content (SSRF-guarded), runs validateSpectralRuleset
// to block disallowed keys such as custom "functions" (the RCE vector), then recurses into
// any nested extends entries. Content is never merged — the original URL is preserved in
// "extends" for Spectral to fetch at lint time using spectralRuntime.fetch.
// Note: We do not flatten the content of remote extends URL entries because users would need to re-upload their ruleset anytime a change is made to a ruleset they extend.
async function validateRemoteExtends(url: URL, visited: Set<string>, depth: number): Promise<void> {
  if (depth > MAX_EXTENDS_DEPTH) {
    throw new Error(`"extends" nested too deeply (max ${MAX_EXTENDS_DEPTH}) at ${url.href}`);
  }
  if (visited.has(url.href)) {
    throw new Error(`"extends" cycle detected at ${url.href}`);
  }

  const ruleset = await readRemoteRuleset(url);
  const validation = validateSpectralRuleset(YAML.stringify(ruleset));
  if (!validation.isValid) {
    throw new Error(`Remote ruleset at "${url.href}" failed validation: ${validation.error}`);
  }

  const nextVisited = new Set(visited).add(url.href);
  for (const entry of toArray(ruleset.extends)) {
    if (Array.isArray(entry)) {
      throw new TypeError(
        `Failed to process "extends" entry ${JSON.stringify(entry)}: tuple format (e.g. [path, severity]) is not supported. Use a plain string instead.`,
      );
    }
    if (ALLOWED_EXTENDS_IDENTIFIERS.includes(entry)) continue;
    await validateRemoteExtends(parseRemoteExtendsUrl(entry, url), nextVisited, depth + 1);
  }
}

// Fully inlines a parsed ruleset object into a self-contained ruleset with no remote URLs.
// Recursively fetches any remote "extends" entries (SSRF-guarded + validated), merges their
// rules, and keeps only built-in identifiers (spectral:oas, …) in "extends". This is the basis
// for the compiled ruleset the lint worker consumes, eliminating the validate-then-use race.
// baseUrl is used to resolve relative URLs found inside remote rulesets; pass null at the top level.
async function flattenRemoteExtends(ruleset: Ruleset, baseUrl: URL | null, visited: Set<string>, depth: number): Promise<Ruleset> {
  const flattened: Ruleset = {};
  const builtinExtends: string[] = [];

  for (const entry of toArray(ruleset.extends)) {
    if (Array.isArray(entry)) {
      throw new TypeError(
        `Failed to process "extends" entry ${JSON.stringify(entry)}: tuple format (e.g. [path, severity]) is not supported. Use a plain string instead.`,
      );
    }
    if (ALLOWED_EXTENDS_IDENTIFIERS.includes(entry)) {
      builtinExtends.push(entry);
      continue;
    }
    const url = parseRemoteExtendsUrl(entry, baseUrl ?? undefined);
    if (depth > MAX_EXTENDS_DEPTH) {
      throw new Error(`"extends" nested too deeply (max ${MAX_EXTENDS_DEPTH}) at ${url.href}`);
    }
    if (visited.has(url.href)) {
      throw new Error(`"extends" cycle detected at ${url.href}`);
    }
    const remote = await readRemoteRuleset(url);
    const validation = validateSpectralRuleset(YAML.stringify(remote));
    if (!validation.isValid) {
      throw new Error(`Remote ruleset at "${url.href}" failed validation: ${validation.error}`);
    }
    const child = await flattenRemoteExtends(remote, url, new Set(visited).add(url.href), depth + 1);
    if (child.extends) {
      builtinExtends.push(...(child.extends as string[]));
    }
    mergeInto(flattened, child);
  }

  const ownOverrides: Ruleset = { ...ruleset };
  delete ownOverrides.extends;
  mergeInto(flattened, ownOverrides);

  const uniqueExtends = [...new Set(builtinExtends)];
  delete flattened.extends;
  return uniqueExtends.length > 0 ? { extends: uniqueExtends, ...flattened } : flattened;
}

// Recursively processes a local ruleset file's "extends" entries:
// - Local file paths are loaded and their rules merged into the output.
// - Remote URLs are validated (SSRF + content) then kept in "extends" for Spectral to fetch at lint time.
// - Built-in identifiers (spectral:oas, …) are kept in "extends" for Spectral to resolve locally.
// Parent rules always override child rules with the same name; among multiple extends entries
// later ones override earlier ones. (ref: https://docs.stoplight.io/docs/spectral/83527ef2dd8c0-extending-rulesets)
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

  const flattenedRuleset: Ruleset = {};
  // Collects entries that stay in "extends": built-in spectral identifiers and, in bundle mode,
  // remote URLs (already validated by validateRemoteExtends). Local file paths are flattened out
  // entirely; in compile mode (inlineRemote) remote URLs are flattened out too.
  const remainingExtends: string[] = [];

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
    if (!entry.startsWith('./') && !entry.startsWith('../') && !path.isAbsolute(entry)) {
      // Bundle mode: validate upfront (SSRF + content checks), then preserve the URL in "extends"
      // as the pollable source. The compile step inlines it before linting.
      await validateRemoteExtends(parseRemoteExtendsUrl(entry), nextVisited, depth + 1);
      remainingExtends.push(entry);
      continue;
    }
    // Local file paths are recursively loaded and flattened.
    const childRuleset = await flattenRuleset(
      path.resolve(baseDir, entry),
      nextVisited,
      depth + 1,
      rootDir,
    );
    if (childRuleset.extends) {
      remainingExtends.push(...childRuleset.extends);
    }
    mergeInto(flattenedRuleset, childRuleset); // later extends entries override earlier ones
  }

  // Apply the current file's own rules on top; if parent and child define the same rule, the parent wins.
  const parentOverrides: Ruleset = { ...ruleset };
  delete parentOverrides.extends;
  mergeInto(flattenedRuleset, parentOverrides);

  // Deduplicate while preserving order (e.g. two local extends both pulling in spectral:oas).
  const uniqueExtends = [...new Set(remainingExtends)];
  delete flattenedRuleset.extends;
  return uniqueExtends.length > 0 ? { extends: uniqueExtends, ...flattenedRuleset } : flattenedRuleset;
}

// Entry point for ruleset processing at upload/storage time. Flattens all local "extends" into a
// single ruleset, validates all remote "extends" URLs (SSRF + content), validates the merged
// output for disallowed keys (e.g. "functions"), and returns the result as a YAML string.
// The output is safe to STORE: local content is fully merged, remote URLs have been pre-vetted
// and are preserved in "extends" as the pollable source. Use compileSpectralRulesetFromContent
// to produce the URL-free object that is actually linted.
export async function bundleSpectralRuleset(sourcePath: string): Promise<string> {
  const rootDir = path.dirname(path.resolve(sourcePath));
  const flattenedRuleset = await flattenRuleset(sourcePath, new Set(), 0, rootDir);
  const yaml = YAML.stringify(flattenedRuleset);
  const validation = validateSpectralRuleset(yaml);
  if (!validation.isValid) {
    throw new Error(`Invalid Spectral ruleset: ${validation.error}`);
  }
  return yaml;
}

// Entry point for ruleset processing at lint time. Accepts raw ruleset content (as stored in NeDB)
// where local extends are already flattened and only remote URLs remain. Fetches, validates, and
// fully inlines all remote "extends" URLs via flattenRemoteExtends, leaving only built-in
// identifiers (spectral:oas, …). The returned YAML has no remote references, so the lint worker
// has nothing left to fetch — closing the validate-then-use race.
export async function compileSpectralRulesetFromContent(rulesetContent: string): Promise<string> {
  const parsed = YAML.parse(rulesetContent);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Ruleset must be an object at the top level.');
  }
  const result = await flattenRemoteExtends(parsed as Ruleset, null, new Set(), 0);
  const yaml = YAML.stringify(result);
  const validation = validateSpectralRuleset(yaml);
  if (!validation.isValid) {
    throw new Error(`Invalid Spectral ruleset: ${validation.error}`);
  }
  return yaml;
}
