// @flow
import { Spectral } from '@stoplight/spectral';
import type { GlobalOptions } from '../get-options';
import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import logger from '../logger';

export type LintSpecificationOptions = GlobalOptions;

export async function lintSpecification(
  identifier: ?string,
  { workingDir, appDataDir, ci }: LintSpecificationOptions,
): Promise<boolean> {
  const db = await loadDb({ workingDir, appDataDir, filterTypes: ['ApiSpec'] });

  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);

  if (!specFromDb) {
    logger.fatal(`Specification not found.`);
    return false;
  }

  const spectral = new Spectral();
  const results = await spectral.run(specFromDb.contents);

  if (results.length) {
    logger.log(`${results.length} lint errors found. \n`);

    results.forEach(r =>
      logger.log(`${r.range.start.line}:${r.range.start.character} - ${r.message}`),
    );
    return false;
  }

  logger.log(`No linting errors. Yay!`);
  return true;
}
