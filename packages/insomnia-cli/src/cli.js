// @flow

import commander from 'commander';
import * as packageJson from '../package.json';
import { ConversionTypeMap, generateConfig } from './commands/generate';

function makeGenerateCommand() {
  const generate = new commander.Command('generate').description('Code generation utilities');
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
    .action((filePath, cmd) => generateConfig({ filePath, ...cmd.opts() }));

  return generate;
}

export function go(args?: Array<string>, exitOverride?: boolean): void {
  if (!args) {
    args = process.argv;
  }

  const program = new commander.Command();

  // if (exitOverride) {
  //   program.exitOverride(() => {
  //     console.log('error');
  //   });
  // }

  program
    .exitOverride()
    .storeOptionsAsProperties(true)
    .passCommandToAction(true)
    .version(packageJson.version, '-v, --version')
    .description('A CLI for Insomnia!')
    .addCommand(makeGenerateCommand())
    .parse(args);
}
