import { RulesetDefinition, Spectral } from '@stoplight/spectral-core';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { bundleAndLoadRuleset } = require('@stoplight/spectral-ruleset-bundler/with-loader');
import { oas } from '@stoplight/spectral-rulesets';
import { DiagnosticSeverity } from '@stoplight/types';
import fs from 'fs';
import path from 'path';

import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { InsoError } from '../errors';
import type { GlobalOptions } from '../get-options';
import { logger } from '../logger';

export type LintSpecificationOptions = GlobalOptions;

export async function lintSpecification(
  identifier: string | null | undefined,
  { workingDir, appDataDir, ci, src }: LintSpecificationOptions,
) {
  const db = await loadDb({
    workingDir,
    appDataDir,
    filterTypes: ['ApiSpec'],
    src,
  });

  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);
  let specContent = '';
  let ruleset = oas;
  try {
    if (specFromDb?.contents) {
      logger.trace('Linting specification from database contents');
      specContent = specFromDb.contents;
    } else if (identifier) {
      // try load as a file
      const fileName = path.isAbsolute(identifier)
        ? identifier
        : path.join(workingDir || process.cwd(), identifier);
      logger.trace(`Linting specification from file \`${fileName}\``);

      try {
        specContent = (await fs.promises.readFile(fileName)).toString();
        const filesInSpecFolder = await fs.promises.readdir(path.dirname(fileName));
        const rulesetFileName = filesInSpecFolder.find(file => file.startsWith('.spectral'));
        if (rulesetFileName) {
          logger.trace(`Loading ruleset from \`${rulesetFileName}\``);
          ruleset = await bundleAndLoadRuleset(path.join(path.dirname(fileName), rulesetFileName), { fs });
        } else {
          logger.info(`Using ruleset: oas, see ${oas.documentationUrl}`);
        }

      } catch (error) {
        throw new InsoError(`Failed to read "${fileName}"`, error);
      }
    } else {
      logger.fatal('Specification not found.');
      return false;
    }
  } catch (error) {
    logger.fatal(error.message);
    return false;
  }

  const spectral = new Spectral();
  spectral.setRuleset(ruleset as RulesetDefinition);
  const results = await spectral.run(specContent);
  if (results.length) {
    // Print Summary
    if (results.some(r => r.severity === DiagnosticSeverity.Error)) {
      logger.fatal(`${results.filter(r => r.severity === DiagnosticSeverity.Error).length} lint errors found. \n`);
    }
    if (results.some(r => r.severity === DiagnosticSeverity.Warning)) {
      logger.warn(`${results.filter(r => r.severity === DiagnosticSeverity.Warning).length} lint warnings found. \n`);
    }
    results.forEach(r =>
      logger.log(`${r.range.start.line + 1}:${r.range.start.character + 1} - ${DiagnosticSeverity[r.severity]} - ${r.code} - ${r.message} - ${r.path.join('.')}`),
    );

    // Fail if errors present
    if (results.some(r => r.severity === DiagnosticSeverity.Error)) {
      logger.log('Errors found, failing lint.');
      return false;
    }
  } else {
    logger.log('No linting errors or warnings.');
  }
  return true;
}
