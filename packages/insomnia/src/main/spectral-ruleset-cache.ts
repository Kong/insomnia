import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import { compileSpectralRuleset } from '~/common/bundle-spectral-ruleset';

// The compiled ruleset is a URL-free, fully-inlined object derived from a stored source
// ruleset. It is cached under userData (never inside a git repo) so the lint worker reads an
// object with no remote references — there is nothing left for it to fetch, which closes the
// validate-then-use race in the linting pipeline.
const CACHE_DIR_NAME = 'lint-cache';

export function contentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

// Derives the on-disk path for the compiled artifact of a given source ruleset. Keyed by a hash
// of the resolved source path so different projects/rulesets never collide. The basename is kept
// as `.spectral.yaml` to satisfy any downstream path expectations.
export function compiledRulesetPathFor(sourcePath: string): string {
  const key = contentHash(path.resolve(sourcePath));
  return path.join(app.getPath('userData'), CACHE_DIR_NAME, key, '.spectral.yaml');
}

// Compiles a source ruleset (fetching + validating + inlining any remote extends) and writes the
// result to its compiled-cache path. Returns the compiled path, content, and a content hash for
// change detection. Throws if the source is missing or fails validation.
export async function writeCompiledRuleset(sourcePath: string): Promise<{
  compiledPath: string;
  content: string;
  hash: string;
}> {
  const content = await compileSpectralRuleset(sourcePath);
  const compiledPath = compiledRulesetPathFor(sourcePath);
  await fs.promises.mkdir(path.dirname(compiledPath), { recursive: true });
  await fs.promises.writeFile(compiledPath, content, 'utf8');
  return { compiledPath, content, hash: contentHash(content) };
}
