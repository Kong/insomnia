// @flow

import { createCommand, program } from 'commander';
import * as packageJson from '../package.json';
import { ConversionTypeMap, generateConfig } from './commands/generate';

function makeGenerateCommand() {
  const generate = createCommand('generate').description('Code generation utilities');
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
    .action(generateConfig); // parse known options

  return generate;
}

export function go(args?: Array<string>): void {
  if (!args) {
    args = process.argv;
  }

  program
    .storeOptionsAsProperties(false)
    .passCommandToAction(false)
    .version(packageJson.version, '-v, --version')
    .description('A CLI for Insomnia!')
    .addCommand(makeGenerateCommand())
    .parseAsync(args)
    .catch(err => console.error(err));
}
