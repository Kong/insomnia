// @flow
import * as o2k from 'openapi-2-kong';
import YAML from 'yaml';
import path from 'path';
import fs from 'fs';
import type { GlobalOptions } from '../util';
import { gitDataDirDb } from '../db/mem-db';

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
): Promise<boolean> {
  if (!validateOptions(options)) {
    return false;
  }

  const { type, output } = options;

  const workingDir = options.workingDir || '.';

  const db = await gitDataDirDb({ dir: workingDir, filterTypes: ['ApiSpec'] });

  let result: ConversionResult;

  // try get from db
  const specFromDb = db.ApiSpec.get(identifier);

  if (specFromDb?.contents) {
    result = await o2k.generateFromString(specFromDb.contents, ConversionTypeMap[type]);
  } else {
    // try load as a file
    const fileName = path.join(workingDir, identifier);
    result = await o2k.generate(fileName, ConversionTypeMap[type]);
  }

  const yamlDocs = result.documents.map(d => YAML.stringify(d));

  // Join the YAML docs with "---" and strip any extra newlines surrounding them
  const document = yamlDocs.join('\n---\n').replace(/\n+---\n+/g, '\n---\n');

  if (output) {
    const fullOutputPath = path.join(workingDir, output);
    fs.writeFileSync(fullOutputPath, document);
  } else {
    console.log(document);
  }

  return true;
}
