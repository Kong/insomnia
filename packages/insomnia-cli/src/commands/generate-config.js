// @flow
import * as o2k from 'openapi-2-kong';
import YAML from 'yaml';
import path from 'path';
import fs from 'fs';
import type { GlobalOptions } from '../util';
import { gitDataDirDb } from '../db/mem-db';
import type { ApiSpec } from '../db/types';
import type { Database } from '../db/mem-db';
import { AutoComplete } from 'enquirer';

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
    console.log(`Config type "${type}" not unrecognized. Options are [${conversionTypes}].`);
    return false;
  }

  return true;
}

async function getApiSpecFromIdentifier(db: Database, identifier?: string): Promise<?ApiSpec> {
  const allSpecs = Array.from(db.ApiSpec.values());

  if (identifier) {
    const result = allSpecs.find(s => s.fileName === identifier || s._id.startsWith(identifier));
    return result;
  }

  const prompt = new AutoComplete({
    name: 'apiSpec',
    message: 'Select an API Specification',
    choices: ['Dummy spec - spc_123456', 'I exist (not) - spc_789123'].concat(
      allSpecs.map(s => `${s.fileName} - ${s._id.substr(0, 10)}`),
    ),
  });

  const [, idIsh] = (await prompt.run()).split(' - ');
  return allSpecs.find(s => s._id.startsWith(idIsh));
}

export async function generateConfig(
  identifier?: string,
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
  const specFromDb = await getApiSpecFromIdentifier(db, identifier);

  if (specFromDb?.contents) {
    result = await o2k.generateFromString(specFromDb.contents, ConversionTypeMap[type]);
  } else if (identifier) {
    // try load as a file
    const fileName = path.join(workingDir, identifier);
    result = await o2k.generate(fileName, ConversionTypeMap[type]);
  } else {
    return false;
  }

  const yamlDocs = result.documents.map(d => YAML.stringify(d));

  // Join the YAML docs with "---" and strip any extra newlines surrounding them
  const document = yamlDocs.join('\n---\n').replace(/\n+---\n+/g, '\n---\n');

  if (output) {
    const fullOutputPath = path.join(workingDir, output);
    await fs.promises.writeFile(fullOutputPath, document);
  } else {
    console.log(document);
  }

  return true;
}
