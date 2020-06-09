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

type GenerateConfigOptions = {|
  type: $Keys<typeof ConversionTypeMap>,
  output?: string,
|};

async function handleGenerateConfig(
  filePath: string,
  { type, output }: GenerateConfigOptions,
): Promise<void> {
  if (!ConversionTypeMap[type]) {
    console.log(
      `--type ${type} not recognized. Options are: [${Object.keys(ConversionTypeMap).join(', ')}]`,
    );
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
  const generate = createCommand('generate');

  generate
    .command('config <filePath>')
    .option(
      '-t, --type <type>',
      `type of configuration - options: [${Object.keys(ConversionTypeMap).join(', ')}]`,
    )
    .option('-o, --output <name>', 'output path')
    .description('Generate configuration from an api spec')
    .action(handleGenerateConfig);

  return generate;
}
