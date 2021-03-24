import type { GlobalOptions } from '../get-options';
import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { writeFileWithCliOptions } from '../write-file';
import { logger } from '../logger';

export type ExportSpecificationOptions = GlobalOptions & {
  output?: string;
};

export async function exportSpecification(
  identifier: string | null | undefined,
  { output, workingDir, appDataDir, ci }: ExportSpecificationOptions,
): Promise<boolean> {
  const db = await loadDb({
    workingDir,
    appDataDir,
    filterTypes: ['ApiSpec'],
  });
  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);

  if (!specFromDb) {
    logger.fatal('Specification not found.');
    return false;
  }

  if (output) {
    const outputPath = await writeFileWithCliOptions(output, specFromDb.contents, workingDir);
    logger.log(`Specification exported to "${outputPath}".`);
  } else {
    logger.log(specFromDb.contents);
  }

  return true;
}
