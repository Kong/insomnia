// @flow
import type { GlobalOptions } from '../util';
import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';

export type ExportSpecificationOptions = GlobalOptions & {
  output?: string,
};

export async function exportSpecification(
  identifier: ?string,
  { output, workingDir, appDataDir, ci }: ExportSpecificationOptions,
): Promise<boolean> {
  const db = await loadDb({ workingDir, appDataDir, filterTypes: ['ApiSpec'] });

  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);

  if (!specFromDb) {
    console.log(`Specification not found.`);
    return false;
  }

  if (output) {
    const workingDirPath = path.join(workingDir || '.', output);
    const fullOutputPath = path.extname(workingDirPath)
      ? workingDirPath
      : path.join(workingDirPath, `${specFromDb.fileName}.${specFromDb.contentType}`);

    mkdirp.sync(path.dirname(fullOutputPath));
    await fs.promises.writeFile(fullOutputPath, specFromDb.contents);
    console.log(`Specification exported to ${fullOutputPath}`);
  } else {
    console.log(specFromDb.contents);
  }

  return true;
}
