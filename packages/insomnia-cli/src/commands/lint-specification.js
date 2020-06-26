// @flow

import { Spectral } from '@stoplight/spectral';
import type { GlobalOptions } from '../util';
import { getApiSpecFromIdentifier, gitDataDirDb } from '../db/mem-db';

export type LintSpecificationOptions = GlobalOptions;

export async function lintSpecification(
  identifier?: string,
  options: LintSpecificationOptions,
): Promise<boolean> {
  const workingDir = options.workingDir || '.';

  const db = await gitDataDirDb({ dir: workingDir, filterTypes: ['ApiSpec'] });

  const specFromDb = await getApiSpecFromIdentifier(db, identifier);

  if (!specFromDb) {
    console.log(`Specification not found. :(`);
    return false;
  }

  const spectral = new Spectral();
  const results = await spectral.run(specFromDb?.contents);

  if (results.length) {
    console.log(`${results.length} lint errors found. \n`);

    results.forEach(r =>
      console.log(`${r.range.start.line}:${r.range.start.character} - ${r.message}`),
    );
    return false;
  }

  console.log(`No linting errors. Yay!`);
  return true;
}
