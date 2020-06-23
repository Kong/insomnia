// @flow

import { Spectral } from '@stoplight/spectral';
import type { GlobalOptions } from '../util';
import { gitDataDirDb } from '../db/mem-db';

export type LintSpecificationOptions = GlobalOptions<{||}>;

export async function lintSpecification(
  identifier: string,
  options: LintSpecificationOptions,
): Promise<void> {
  const { workingDir } = options;

  const db = await gitDataDirDb({ dir: workingDir, filterTypes: ['ApiSpec'] });

  const specFromDb = db.ApiSpec.get(identifier);

  const spectral = new Spectral();
  const results = await spectral.run(specFromDb?.contents);

  console.log(JSON.stringify(results));
}
