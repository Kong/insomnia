import YAML from 'yaml';

import { type GlobalOptions, logger } from '../cli';
import { getAbsolutePath, loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { writeFileWithCliOptions } from '../write-file';

export type ExportSpecificationOptions = GlobalOptions & {
  output?: string;
  skipAnnotations?: boolean;
};

export async function exportSpecification(
  identifier: string | null | undefined,
  { output, skipAnnotations, workingDir, ci, src }: ExportSpecificationOptions,
) {
  const db = await loadDb({
    workingDir,
    filterTypes: ['ApiSpec'],
    src,
  });
  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);

  if (!specFromDb) {
    const pathToSearch = getAbsolutePath({ workingDir, src });
    logger.fatal('Specification not found at: ' + pathToSearch);
    return false;
  }

  if (!skipAnnotations) {
    if (!output) {
      logger.log(specFromDb.contents);
      return true;
    }
    const outputPath = await writeFileWithCliOptions(output, specFromDb.contents, workingDir);
    logger.log(`Specification exported to "${outputPath}".`);
    return true;
  }

  const recursiveDeleteKey = (obj: any) => {
    Object.keys(obj).forEach(key => {
      if (key.startsWith('x-kong-')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        recursiveDeleteKey(obj[key]);
      }
    });
    return obj;
  };
  const cleaned = YAML.stringify(recursiveDeleteKey(YAML.parse(specFromDb.contents)));
  logger.debug('Removed keys starting with x-kong-');
  if (!output) {
    logger.log(cleaned);
    return true;
  }
  const outputPath = await writeFileWithCliOptions(output, cleaned, workingDir);
  logger.log(`Specification exported to "${outputPath}".`);

  return true;
}
