// @flow
import { createCommand } from 'commander';
import * as o2k from 'openapi-2-kong';
import YAML from 'yaml';
import path from 'path';
import fs from 'fs';

const ConversionTypeMap: { [string]: o2k.ConversionResultType } = {
  kubernetes: 'kong-for-kubernetes',
  declarative: 'kong-declarative-config',
};
const conversionTypes = Object.keys(ConversionTypeMap).join(', ');

type GenerateConfigOptions = {|
  type: $Keys<typeof ConversionTypeMap>,
  output?: string,
|};

async function handleGenerateConfig(
  filePath: string,
  { type, output }: GenerateConfigOptions,
): Promise<void> {
  if (!ConversionTypeMap[type]) {
    console.log(`--type ${type} not recognized. Options are [${conversionTypes}]`);
    return;
  }

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

export function makeGenerateCommand() {
  const generate = createCommand('generate').description('Code generation utilities');

  generate
    .command('config <filePath>')
    .description('Generate configuration from an api spec')
    .requiredOption(
      '--type <value>',
      `the type of configuration to generate, options are [${conversionTypes}]`,
    )
    .option('-o, --output <path>', 'the output path')
    .action(handleGenerateConfig);

  return generate;
}
