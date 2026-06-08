import type { RulesetDefinition } from '@stoplight/spectral-core';
import { Spectral } from '@stoplight/spectral-core';

const { bundleAndLoadRuleset } = require('@stoplight/spectral-ruleset-bundler/with-loader');
import dns from 'node:dns/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Resolver } from '@stoplight/spectral-ref-resolver';
import { oas } from '@stoplight/spectral-rulesets';
import { fetch as spectralFetch } from '@stoplight/spectral-runtime';
import { DiagnosticSeverity } from '@stoplight/types';
import { bundleSpectralRuleset, compileSpectralRulesetFromContent } from 'insomnia/src/common/bundle-spectral-ruleset';
import { isPrivateOrLoopbackHost } from 'insomnia/src/common/private-host';

import { InsoError } from '../errors';
import { logger } from '../logger';

// Protect against SSRF attacks in spec $ref resolution.
// Note: This is duplicated in insomnia's main/lint-process.mjs. Remember to mirror changes there as well.
function isSafeRefUrl(href: string): boolean {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') {
    return false;
  }
  return Boolean(url.hostname) && !isPrivateOrLoopbackHost(url.hostname.toLowerCase());
}

// Block hosts that resolve to private/loopback addresses (e.g. *.localtest.me → 127.0.0.1),
// Note: This is duplicated in insomnia's main/lint-process.mjs. Remember to mirror changes there as well.
async function assertResolvesToPublicHost(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true });
  for (const { address } of records) {
    if (isPrivateOrLoopbackHost(address)) {
      throw new Error(`Failed to resolve host. "${hostname}" resolves to a private or loopback address.`);
    }
  }
}

// Note: This is duplicated in insomnia's main/lint-process.mjs. Remember to mirror changes there as well.
const safeHttpResolver = {
  async resolve(ref: { href: () => string }): Promise<string> {
    const href = ref.href();
    if (!isSafeRefUrl(href)) {
      throw new Error(`Failed to resolve "${href}". Only https URLs to public hosts are allowed.`);
    }
    await assertResolvesToPublicHost(new URL(href).hostname.toLowerCase());
    const response = await fetch(href, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch "${href}": ${response.status} ${response.statusText}`);
    }
    return response.text();
  },
};

export const safeRefResolver = new Resolver({
  resolvers: {
    http: safeHttpResolver,
    https: safeHttpResolver,
  },
});

export const getRuleSetFileFromFolderByFilename = async (filePath: string) => {
  try {
    const filesInSpecFolder = await fs.promises.readdir(path.dirname(filePath));
    const rulesetFileName = filesInSpecFolder.find(file => file.startsWith('.spectral'));
    if (rulesetFileName) {
      logger.trace(`Loading ruleset from \`${rulesetFileName}\``);
      return path.resolve(path.dirname(filePath), rulesetFileName);
    }
    logger.info(`Using ruleset: oas, see ${oas.documentationUrl}`);
    return;
  } catch (error) {
    throw new InsoError(`Failed to read "${filePath}"`, error);
  }
};
export async function lintSpecification({
  specContent,
  rulesetFileName,
}: {
  specContent: string;
  rulesetFileName?: string;
}) {
  const spectral = new Spectral({ resolver: safeRefResolver });
  // Use custom ruleset if present
  let ruleset = oas;
  try {
    if (rulesetFileName) {
      // Step 1: flatten local extends and validate remote URLs (SSRF + disallowed keys).
      const bundled = await bundleSpectralRuleset(rulesetFileName);
      // Step 2: fetch + fully inline remote extends so bundleAndLoadRuleset has nothing to fetch,
      // closing the validate-then-use race.
      const compiledContent = await compileSpectralRulesetFromContent(bundled);
      // bundleAndLoadRuleset requires a file path, so write the compiled object to a
      // uniquely-named temp directory and clean it up immediately after loading.
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'spectral-'));
      try {
        const tempRulesetPath = path.join(tempDir, '.spectral.yaml');
        await fs.promises.writeFile(tempRulesetPath, compiledContent, { encoding: 'utf8' });
        ruleset = await bundleAndLoadRuleset(tempRulesetPath, { fs, fetch: spectralFetch });
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    }
  } catch (error) {
    logger.fatal(error.message);
    return { isValid: false };
  }

  spectral.setRuleset(ruleset as RulesetDefinition);
  const results = await spectral.run(specContent);

  if (!results.length) {
    logger.log('No linting errors or warnings.');
    return { results, isValid: true };
  }
  // Print Summary
  if (results.some(r => r.severity === DiagnosticSeverity.Error)) {
    logger.fatal(`${results.filter(r => r.severity === DiagnosticSeverity.Error).length} lint errors found. \n`);
  }
  if (results.some(r => r.severity === DiagnosticSeverity.Warning)) {
    logger.warn(`${results.filter(r => r.severity === DiagnosticSeverity.Warning).length} lint warnings found. \n`);
  }
  results.forEach(r =>
    logger.log(
      `${r.range.start.line + 1}:${r.range.start.character + 1} - ${DiagnosticSeverity[r.severity]} - ${r.code} - ${
        r.message
      } - ${r.path.join('.')}`,
    ),
  );

  // Fail if errors present
  if (results.some(r => r.severity === DiagnosticSeverity.Error)) {
    logger.log('Errors found, failing lint.');
    return { results, isValid: false };
  }
  return { results, isValid: true };
}
