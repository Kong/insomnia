// @flow
import type { GlobalOptions } from '../util';
import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { writeFileWithCliOptions } from '../write-file';

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
    const outputPath = await writeFileWithCliOptions(
      output,
      specFromDb.contents,
      `${specFromDb.fileName}.${specFromDb.contentType}`,
      workingDir,
    );
    console.log(`Specification exported to "${outputPath}".`);
  } else {
    console.log(specFromDb.contents);
  }

  return true;
}
