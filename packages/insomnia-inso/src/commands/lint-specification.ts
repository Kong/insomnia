import { RulesetDefinition, Spectral } from '@stoplight/spectral-core';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { bundleAndLoadRuleset } = require('@stoplight/spectral-ruleset-bundler/with-loader');
import { oas } from '@stoplight/spectral-rulesets';
import { DiagnosticSeverity } from '@stoplight/types';
import fs from 'fs';
import path from 'path';

import { InsoError, logger } from '../cli';
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
export async function lintSpecification({ specContent, rulesetFileName }: { specContent: string; rulesetFileName?: string },) {
  const spectral = new Spectral();
  // Use custom ruleset if present
  let ruleset = oas;
  try {
    if (rulesetFileName) {
      ruleset = await bundleAndLoadRuleset(rulesetFileName, { fs });
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
    logger.log(`${r.range.start.line + 1}:${r.range.start.character + 1} - ${DiagnosticSeverity[r.severity]} - ${r.code} - ${r.message} - ${r.path.join('.')}`),
  );

  // Fail if errors present
  if (results.some(r => r.severity === DiagnosticSeverity.Error)) {
    logger.log('Errors found, failing lint.');
    return { results, isValid: false };
  }
  return { results, isValid: true };
}
