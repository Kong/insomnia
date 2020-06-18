// @flow
import { ConversionTypeMap, generateConfig } from './commands/generate';
import { getVersion, createCommand, getAllOptions } from './util';

function makeGenerateCommand(exitOverride: boolean) {
  // inso generate
  const generate = createCommand(exitOverride, 'generate').description('Code generation utilities');

  const conversionTypes = Object.keys(ConversionTypeMap).join(', ');

  // inso generate config -t kubernetes config.yaml
  generate
    .command('config <identifier>')
    .description('Generate configuration from an api spec')
    .requiredOption(      '-t, --type <value>',      `the type of configuration ajkhsdfk to generate, options are [${conversionTypes}]`,    )
    .option('-o, --output <path>', 'the output path')
    .action((identifier, cmd) => generateConfig(identifier, getAllOptions(cmd)));

  return generate;
}

export function go(args?: Array<string>, exitOverride?: boolean): void {
  if (!args) {
    args = process.argv;
  }

  // inso -v
  createCommand(!!exitOverride)
    .version(getVersion(), '-v, --version')
    .description('A CLI for Insomnia!')
    .option('--workingDir <dir>', 'Working directory')
    .addCommand(makeGenerateCommand(!!exitOverride))
    .parseAsync(args)
    .catch(err => console.log('An error occurred', err));
}
