// @flow
import * as packageJson from '../package.json';
import { ConversionTypeMap, generateConfig } from './commands/generate';
import util from './util';

function makeGenerateCommand(exitOverride?: boolean) {
  const generate = util
    .createCommand('generate', exitOverride)
    .description('Code generation utilities');

  const conversionTypes = Object.keys(ConversionTypeMap).join(', ');

  // generate config sub-command
  generate
    .command('config <filePath>')
    .description('Generate configuration from an api spec')
    .requiredOption(
      '-t, --type <value>',
      `the type of configuration to generate, options are [${conversionTypes}]`,
    )
    .option('-o, --output <path>', 'the output path')
    .action((filePath, opts) => generateConfig({ filePath, ...opts }));

  return generate;
}

export function go(args?: Array<string>, exitOverride?: boolean): void {
  if (!args) {
    args = process.argv;
  }

  util
    .createCommand(null, exitOverride)
    .version(packageJson.version, '-v, --version')
    .description('A CLI for Insomnia!')
    .addCommand(makeGenerateCommand(exitOverride))
    .parse(args);
}
