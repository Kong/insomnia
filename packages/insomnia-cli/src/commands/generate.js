// @flow
import * as o2k from 'openapi-2-kong';
import YAML from 'yaml';
import path from 'path';
import fs from 'fs';
import type { GlobalOptions } from '../util';
import * as db from './git-nedb';

export const ConversionTypeMap: { [string]: ConversionResultType } = {
  kubernetes: 'kong-for-kubernetes',
  declarative: 'kong-declarative-config',
};

export type GenerateConfigOptions = GlobalOptions<{|
  type: $Keys<typeof ConversionTypeMap>,
  output?: string,
|}>;

function validateOptions({ type }: GenerateConfigOptions): boolean {
  if (!ConversionTypeMap[type]) {
    const conversionTypes = Object.keys(ConversionTypeMap).join(', ');
    console.log(`Config type "${type}" not unrecognized. Options are [${conversionTypes}].`);
    return false;
  }

  return true;
}

export async function generateConfig(
  identifier: string,
  options: GenerateConfigOptions,
): Promise<void> {
  if (!validateOptions(options)) {
    return;
  }

  const { type, output, workingDir } = options;

  let result: ConversionResult;

  await db.seedGitDataDir(workingDir);
  const specFromDb = await db.getWhere('ApiSpec', { _id: identifier });

  try {
    if (specFromDb?.contents) {
      result = await o2k.generateFromString(specFromDb.contents, ConversionTypeMap[type]);
    } else {
      result = await o2k.generate(identifier, ConversionTypeMap[type]);
    }
  } catch (err) {
    console.log('Config failed to generate', err);
    return;
  }

  const yamlDocs = result.documents.map(d => YAML.stringify(d));

  // Join the YAML docs with "---" and strip any extra newlines surrounding them
  const document = yamlDocs.join('\n---\n').replace(/\n+---\n+/g, '\n---\n');

  if (output) {
    const fullOutputPath = path.resolve(output);
    fs.writeFileSync(fullOutputPath, document);
  } else {
    console.log(document);
  }
}
