import { RulesetDefinition, Spectral } from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';
const { bundleAndLoadRuleset } = require("@stoplight/spectral-ruleset-bundler/with-loader");
import fs from 'fs';
import path from 'path';

import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { ApiSpecRuleset } from '../db/models/types';
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
    filterTypes: ['ApiSpec', 'ApiSpecRuleset'],
    src,
  });

  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);
  let specContent = '';

  try {
    if (specFromDb?.contents) {
      logger.trace('Linting specification from database contents');
      specContent = specFromDb.contents;
    } else if (identifier) {
      // try load as a file
      const fileName = path.isAbsolute(identifier)
        ? identifier
        : path.join(workingDir || '.', identifier);
      logger.trace(`Linting specification from file \`${fileName}\``);

      try {
        specContent = (await fs.promises.readFile(fileName)).toString();
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

  let providedRuleset: ApiSpecRuleset | undefined;
  if (specFromDb?.parentId){
    providedRuleset = db.ApiSpecRuleset.find(
      ruleset => specFromDb.parentId === ruleset.parentId
    );
  }

  if (providedRuleset && providedRuleset.contents){
    const r = await bundleAndLoadRuleset("file:///inso.custom-spectral-config.yaml", {
      fs: { promises: { readFile: () => { return providedRuleset!.contents; }}  as any}
    })
    spectral.setRuleset(r);
  } else {
    await spectral.setRuleset(oas as RulesetDefinition);
  }

  const results = (await spectral.run(specContent)).filter(result => (
    result.severity === 0 // filter for errors only
  ));

  if (results.length) {
    logger.log(`${results.length} lint errors found. \n`);
    results.forEach(r =>
      logger.log(`${r.range.start.line}:${r.range.start.character} - ${r.message}`),
    );
    return false;
  }

  logger.log('No linting errors. Yay!');
  return true;
}
