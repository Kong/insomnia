import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BrowserWindow } from 'electron';
import YAML from 'yaml';

import { compileSpectralRuleset } from '~/common/bundle-spectral-ruleset';
import { services } from '~/insomnia-data';

import { contentHash } from './spectral-ruleset-cache';

// How often to re-check remote extends for upstream changes.
const REFRESH_INTERVAL_MS = 60_000;

// Last compiled-output hash observed per project, used to detect upstream changes between ticks.
const lastCompiledHash = new Map<string, string>();

let refreshTimer: NodeJS.Timeout | null = null;

// True if the stored source ruleset references at least one remote extends URL. Sources with only
// local (already-flattened) rules or built-in identifiers never change upstream, so we skip them.
function hasRemoteExtends(rulesetContent: string): boolean {
  let parsed: unknown;
  try {
    parsed = YAML.parse(rulesetContent);
  } catch {
    return false;
  }
  if (parsed === null || typeof parsed !== 'object') {
    return false;
  }
  const extendsValue = (parsed as { extends?: unknown }).extends;
  const entries = Array.isArray(extendsValue) ? extendsValue : extendsValue === undefined ? [] : [extendsValue];
  return entries.some(entry => typeof entry === 'string' && /^https?:\/\//i.test(entry));
}

// Notify all renderer windows that a project's ruleset has changed upstream so they can re-lint.
// The renderer's lint request re-compiles fresh, producing the updated compiled cache.
function notifyRulesetUpdated(projectId: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('spectral-ruleset.updated', { projectId });
  }
}

// Re-compiles a stored source ruleset (fetching + validating + inlining its remote extends) and
// returns a hash of the result. Compilation reads from a file path, so the stored source content
// is written to a short-lived temp file first. Local extends were already flattened at upload, so
// no local-path resolution is needed here.
async function compileFromSource(rulesetContent: string): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'spectral-refresh-'));
  try {
    const tempPath = path.join(tempDir, '.spectral.yaml');
    await fs.promises.writeFile(tempPath, rulesetContent, { encoding: 'utf8' });
    const compiled = await compileSpectralRuleset(tempPath);
    return contentHash(compiled);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

export async function refreshOnce(): Promise<void> {
  let rulesets;
  try {
    rulesets = await services.projectLintRuleset.all();
  } catch (err) {
    console.warn('[spectral-refresh] failed to load rulesets:', err);
    return;
  }

  for (const ruleset of rulesets) {
    if (!ruleset.rulesetContent || !hasRemoteExtends(ruleset.rulesetContent)) {
      continue;
    }
    try {
      const hash = await compileFromSource(ruleset.rulesetContent);
      const previous = lastCompiledHash.get(ruleset.parentId);
      lastCompiledHash.set(ruleset.parentId, hash);
      // Skip the first observation (baseline) and unchanged content; only notify on a real change.
      if (previous !== undefined && previous !== hash) {
        console.log(`[spectral-refresh] remote ruleset changed for project ${ruleset.parentId}; re-linting`);
        notifyRulesetUpdated(ruleset.parentId);
      }
    } catch (err) {
      // Keep the last known-good baseline; the lint path independently re-compiles and surfaces
      // any hard failure to the user, so a transient fetch/validation error here is non-fatal.
      console.warn(`[spectral-refresh] compile failed for project ${ruleset.parentId}:`, err instanceof Error ? err.message : err);
    }
  }
}

export const init = (): void => {
  if (refreshTimer) {
    return;
  }
  refreshTimer = setInterval(() => {
    refreshOnce().catch(err => console.warn('[spectral-refresh] tick failed:', err));
  }, REFRESH_INTERVAL_MS);
};

export const stop = (): void => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  lastCompiledHash.clear();
};
