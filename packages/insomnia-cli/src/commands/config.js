// @flow
import { createCommand } from 'commander';

type ConfigGenerateOptions = {|
  type: string,
  output?: string,
|};

function handleGenerateConfig(opts: ConfigGenerateOptions) {
  const { type, output } = opts;
  console.log('Generate config for %s at %s', type, output);
}

export function makeConfigCommand() {
  const generate = createCommand('config').description('Generate something...');

  generate
    .command('generate')
    .requiredOption('-t, --type <type>', 'must specify type of configuration to generate')
    .option('-o, --output <dir>', 'where to output', '.')
    .description('Generate configuration')
    .action(handleGenerateConfig);

  return generate;
}
