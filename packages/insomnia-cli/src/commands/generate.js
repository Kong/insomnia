// @flow
import * as o2k from 'openapi-2-kong';
import YAML from 'yaml';
import path from 'path';
import fs from 'fs';

export const ConversionTypeMap: { [string]: o2k.ConversionResultType } = {
  kubernetes: 'kong-for-kubernetes',
  declarative: 'kong-declarative-config',
};
const conversionTypes = Object.keys(ConversionTypeMap).join(', ');

export type GenerateConfigOptions = {|
  type: $Keys<typeof ConversionTypeMap>,
  output?: string,
|};

function validateOptions({ type }: GenerateConfigOptions): boolean {
  if (!ConversionTypeMap[type]) {
    console.log(`Config type "${type}" not unrecognized. Options are [${conversionTypes}].`);
    return false;
  }

  return true;
}

export async function generateConfig(
  filePath: string,
  options: GenerateConfigOptions,
): Promise<void> {
  if (!validateOptions(options)) {
    return;
  }

  const { type, output } = options;

  const result = await o2k.generate(filePath, ConversionTypeMap[type]);

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
