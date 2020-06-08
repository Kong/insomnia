// @flow
import { createCommand } from 'commander';

type GenerateConfigCommand = (
  apiSpecId: string,
  {|
    type: string,
    output?: string,
  |},
) => void;

const handleGenerateConfig: GenerateConfigCommand = (apiSpecId, { type, output }) => {
  console.log('Generate config for %s at %s for %s', type, output, apiSpecId);
};

export function makeGenerateCommand() {
  const generate = createCommand('generate');

  generate
    .command('config <apiSpecId>')
    .option('-t, --type <type>', 'Specify the type of configuration to generate')
    .option('-o, --output <dir>', 'Specify the output directory', '.')
    .description('Generate configuration from an api spec')
    .action(handleGenerateConfig);

  return generate;
}
