import { ConversionResult, ConversionResultType, generate, generateFromString } from 'openapi-2-kong';
import YAML from 'yaml';
import path from 'path';
import type { GlobalOptions } from '../get-options';
import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { writeFileWithCliOptions } from '../write-file';
import { logger } from '../logger';
import { InsoError } from '../errors';

export const conversionTypeMap = {
  kubernetes: 'kong-for-kubernetes',
  declarative: 'kong-declarative-config',
} as const;

export const conversionTypes: ConversionResultType[] = [
  'kong-declarative-config',
  'kong-for-kubernetes',
];

export type GenerateConfigOptions = GlobalOptions & {
  type: keyof (typeof conversionTypeMap);
  output?: string;
};

const validateOptions = (
  options: Partial<GenerateConfigOptions> = {},
): options is Partial<GenerateConfigOptions> & Pick<GenerateConfigOptions, 'type'> => {
  const { type } = options;
  if (!type || !conversionTypeMap[type]) {
    logger.fatal(`Config type "${type}" not unrecognized. Options are [${Object.keys(conversionTypeMap).join(', ')}].`);
    return false;
  }

  return true;
};

export const generateConfig = async (
  identifier: string | null | undefined,
  options: Partial<GenerateConfigOptions>,
) => {
  if (!validateOptions(options)) {
    return false;
  }

  const { type, output, appDataDir, workingDir, ci } = options;
  const db = await loadDb({
    workingDir,
    appDataDir,
    filterTypes: ['ApiSpec'],
  });

  let result: ConversionResult | null = null;

  // try get from db
  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);

  try {
    if (specFromDb?.contents) {
      logger.trace('Generating config from database contents');
      result = await generateFromString(specFromDb.contents, conversionTypeMap[type]);
    } else if (identifier) {
      // try load as a file
      const fileName = path.isAbsolute(identifier)
        ? identifier
        : path.join(workingDir || '.', identifier);
      logger.trace(`Generating config from file \`${fileName}\``);
      result = await generate(fileName, conversionTypeMap[type]);
    }
  } catch (e) {
    throw new InsoError('There was an error while generating configuration', e);
  }

  if (!result?.documents || !Array.isArray(result.documents)) {
    logger.log('Could not find a valid specification to generate configuration.');
    return false;
  }

  const yamlDocs = result.documents.map(document => YAML.stringify(document));
  // Join the YAML docs with "---" and strip any extra newlines surrounding them
  const document = yamlDocs.join('\n---\n').replace(/\n+---\n+/g, '\n---\n');

  if (output) {
    const outputPath = await writeFileWithCliOptions(output, document, workingDir);
    logger.log(`Configuration generated to "${outputPath}".`);
  } else {
    logger.log(document);
  }

  return true;
};
