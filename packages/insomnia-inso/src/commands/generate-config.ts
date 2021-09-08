import { ConversionResult, ConversionResultType, DeclarativeConfig, generate, generateFromString, K8sManifest } from 'openapi-2-kong';
import path from 'path';
import YAML from 'yaml';

import { loadDb } from '../db';
import { loadApiSpec, promptApiSpec } from '../db/models/api-spec';
import { InsoError } from '../errors';
import type { GlobalOptions } from '../get-options';
import { logger } from '../logger';
import { writeFileWithCliOptions } from '../write-file';

export type ConversionOption = 'kubernetes' | 'declarative';

export const conversionOptions: ConversionOption[] = [
  'declarative',
  'kubernetes',
];

export const conversionTypeMap: Record<ConversionOption, ConversionResultType> = {
  kubernetes: 'kong-for-kubernetes',
  declarative: 'kong-declarative-config',
} as const;

export type GenerateConfigOptions = GlobalOptions & {
  type: ConversionOption;
  output?: string;

  /** a comma-separated list of tags */
  tags?: string;
};

const validateOptions = (
  options: Partial<GenerateConfigOptions> = {},
): options is Partial<GenerateConfigOptions> & Pick<GenerateConfigOptions, 'type'> => {
  const { type } = options;
  if (!type || !conversionTypeMap[type]) {
    logger.fatal(`Config type "${type}" not unrecognized. Options are [${conversionOptions.join(', ')}].`);
    return false;
  }

  return true;
};

export const generateConfig = async (
  identifier?: string | null,
  options: Partial<GenerateConfigOptions> = {},
) => {
  if (!validateOptions(options)) {
    return false;
  }

  const { type, output, tags, appDataDir, workingDir, ci, src } = options;
  const db = await loadDb({
    workingDir,
    appDataDir,
    filterTypes: ['ApiSpec'],
    src,
  });

  let result: ConversionResult | null = null;

  // try get from db
  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!ci);

  const generationTags = tags?.split(',');
  const conversionType = conversionTypeMap[type];
  try {
    if (specFromDb?.contents) {
      logger.trace('Generating config from database contents');
      result = await generateFromString(
        specFromDb.contents,
        conversionType,
        generationTags,
      );
    } else if (identifier) {
      // try load as a file
      const fileName = path.isAbsolute(identifier)
        ? identifier
        : path.join(workingDir || '.', identifier);
      logger.trace(`Generating config from file \`${fileName}\``);
      result = await generate(fileName, conversionType, generationTags);
    }
  } catch (e) {
    throw new InsoError('There was an error while generating configuration', e);
  }

  if (!result?.documents || !Array.isArray(result.documents)) {
    logger.log('Could not find a valid specification to generate configuration.');
    return false;
  }

  const yamlDocs = result.documents.map((document: DeclarativeConfig | K8sManifest) => YAML.stringify(document));
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
