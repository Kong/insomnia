import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { compileSpectralRulesetFromContent } from '~/common/bundle-spectral-ruleset';

const lastWrittenHash = new Map<string, string>();

// Derives the on-disk path where the compiled ruleset for a project is written.
// Keyed by projectId so different projects never collide.
export function compiledRulesetPathFor(projectId: string): string {
  const base = process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData');
  return path.join(base, 'projects', projectId, '.spectral.yaml');
}

// Compiles raw ruleset content and writes the flattened result to the project's compiled path.
// Skips recompilation if the content hasn't changed since the last write (keyed by projectId)
// and the compiled file still exists on disk. Throws if compilation fails.
export async function writeCompiledRuleset(
  projectId: string,
  rulesetContent: string,
): Promise<{
  compiledPath: string;
}> {
  const compiledPath = compiledRulesetPathFor(projectId);
  const hash = createHash('sha256').update(rulesetContent).digest('hex');
  if (lastWrittenHash.get(projectId) === hash) {
    try {
      await fs.promises.access(compiledPath);
      console.info('Ruleset content unchanged since last compilation, skipping write');
      return { compiledPath };
    } catch {
      // File was deleted externally — fall through to recompile and rewrite.
    }
  }
  const compiled = await compileSpectralRulesetFromContent(rulesetContent);
  console.info('Creating flattened Spectral ruleset at', compiledPath);
  await fs.promises.mkdir(path.dirname(compiledPath), { recursive: true });
  await fs.promises.writeFile(compiledPath, compiled, 'utf8');
  lastWrittenHash.set(projectId, hash);
  return { compiledPath };
}

// Deletes the compiled ruleset file for a project and clears the in-memory hash cache,
// so the next writeCompiledRuleset call always recompiles from scratch.
export async function deleteCompiledRuleset(projectId: string): Promise<void> {
  const compiledPath = compiledRulesetPathFor(projectId);
  await fs.promises.rm(path.dirname(compiledPath), { recursive: true, force: true });
  lastWrittenHash.delete(projectId);
}
