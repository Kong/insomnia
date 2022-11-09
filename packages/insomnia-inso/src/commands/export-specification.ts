import YAML from 'yaml';

import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import type { GlobalOptions } from '../get-options';
import { logger } from '../logger';
import { writeFileWithCliOptions } from '../write-file';

export type ExportSpecificationOptions = GlobalOptions & {
  output?: string;
  skipAnnotations?: boolean;
};

function  deleteField(obj: any, field: any): void {
  Object.keys(obj).forEach(key => {
    if (key.startsWith(field)) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      deleteField(obj[key], field);
    }
  });
}

export async function exportSpecification(
  identifier: string | null | undefined,
  { output, skipAnnotations, workingDir, appDataDir, ci, src }: ExportSpecificationOptions,
) {
  const db = await loadDb({
    workingDir,
    appDataDir,
    filterTypes: ['ApiSpec'],
    src,
  });
  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);

  if (!specFromDb) {
    logger.fatal('Specification not found.');
    return false;
  }

  let contents = specFromDb.contents;
  if (skipAnnotations) {
    const yamlObj = YAML.parse(contents);
    deleteField(yamlObj, 'x-kong-');
    contents = YAML.stringify(yamlObj);
  }

  if (output) {
    const outputPath = await writeFileWithCliOptions(output, contents, workingDir);
    logger.log(`Specification exported to "${outputPath}".`);
  } else {
    logger.log(contents);
  }

  return true;
}
