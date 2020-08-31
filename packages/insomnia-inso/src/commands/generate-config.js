// @flow
import * as o2k from 'openapi-2-kong';
import YAML from 'yaml';
import path from 'path';
import type { GlobalOptions } from '../get-options';
import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { writeFileWithCliOptions } from '../write-file';
import logger from '../logger';
import { InsoError } from '../errors';

export const ConversionTypeMap: { [string]: ConversionResultType } = {
  kubernetes: 'kong-for-kubernetes',
  declarative: 'kong-declarative-config',
};

export type GenerateConfigOptions = GlobalOptions & {
  type: $Keys<typeof ConversionTypeMap>,
  output?: string,
};

function validateOptions({ type }: GenerateConfigOptions): boolean {
  if (!ConversionTypeMap[type]) {
    const conversionTypes = Object.keys(ConversionTypeMap).join(', ');
    logger.fatal(`Config type "${type}" not unrecognized. Options are [${conversionTypes}].`);
    return false;
  }

  return true;
}

export async function generateConfig(
  identifier: ?string,
  options: GenerateConfigOptions,
): Promise<boolean> {
  if (!validateOptions(options)) {
    return false;
  }

  const { type, output, appDataDir, workingDir, ci } = options;

  const db = await loadDb({ workingDir, appDataDir, filterTypes: ['ApiSpec'] });

  let result: ConversionResult | null = null;

  // try get from db
  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);

  try {
    if (specFromDb?.contents) {
      logger.trace('Generating config from database contents');
      result = await o2k.generateFromString(specFromDb.contents, ConversionTypeMap[type]);
    } else if (identifier) {
      // try load as a file
      const fileName = path.isAbsolute(identifier)
        ? identifier
        : path.join(workingDir || '.', identifier);
      logger.trace(`Generating config from file \`${fileName}\``);
      result = await o2k.generate(fileName, ConversionTypeMap[type]);
    }
  } catch (e) {
    throw new InsoError(`There was an error while generating configuration`, e);
  }

  if (!result?.documents) {
    logger.log('Could not find a valid specification to generate configuration.');

    return false;
  }

  const yamlDocs = result.documents.map(d => YAML.stringify(d));

  // Join the YAML docs with "---" and strip any extra newlines surrounding them
  const document = yamlDocs.join('\n---\n').replace(/\n+---\n+/g, '\n---\n');

  if (output) {
    const outputPath = await writeFileWithCliOptions(output, document, workingDir);
    logger.log(`Configuration generated to "${outputPath}".`);
  } else {
    logger.log(document);
  }

  return true;
}
