import { Spectral, isOpenApiv2, isOpenApiv3 } from '@stoplight/spectral';
import type { GlobalOptions } from '../get-options';
import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { logger } from '../logger';
import { InsoError } from '../errors';
import fs from 'fs';
import path from 'path';

export type LintSpecificationOptions = GlobalOptions;

export async function lintSpecification(
  identifier: string | null | undefined,
  { workingDir, appDataDir, ci }: LintSpecificationOptions,
) {
  const db = await loadDb({
    workingDir,
    appDataDir,
    filterTypes: ['ApiSpec'],
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
      } catch (e) {
        throw new InsoError(`Failed to read "${fileName}"`, e);
      }
    } else {
      logger.fatal('Specification not found.');
      return false;
    }
  } catch (e) {
    logger.fatal(e.message);
    return false;
  }

  const spectral = new Spectral();
  spectral.registerFormat('oas2', isOpenApiv2);
  spectral.registerFormat('oas3', isOpenApiv3);
  await spectral.loadRuleset('spectral:oas');

  const results = (await spectral.run(specContent)).filter(result => (
    result.severity === 0 // filter for errors only
  ));

  if (results.length) {
    logger.log(`${results.length} lint errors found. \n`);
    results.forEach((r) =>
      logger.log(`${r.range.start.line}:${r.range.start.character} - ${r.message}`),
    );
    return false;
  }

  logger.log('No linting errors. Yay!');
  return true;
}
