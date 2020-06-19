// @flow
import { ConversionTypeMap, generateConfig } from './commands/generate';
import { getVersion, createCommand, getAllOptions } from './util';
import { runInsomniaTests, TestReporterEnum } from './commands/test';

function makeGenerateCommand(exitOverride: boolean) {
  // inso generate
  const generate = createCommand(exitOverride, 'generate').description('Code generation utilities');

  const conversionTypes = Object.keys(ConversionTypeMap).join(', ');

  // inso generate config -t kubernetes config.yaml
  generate
    .command('config <identifier>')
    .description('Generate configuration from an api spec')
    .requiredOption(
      '-t, --type <value>',
      `the type of configuration to generate, options are [${conversionTypes}]`,
    )
    .option('-o, --output <path>', 'the output path')
    .action((identifier, cmd) => generateConfig(identifier, getAllOptions(cmd)));

  return generate;
}

function makeTestCommand(exitOverride: boolean) {
  // inso test
  const test = createCommand(exitOverride, 'test').description('Unit testing utilities');

  const reporterTypes = Object.keys(TestReporterEnum).join(', ');

  // inso test run
  test
    .command('run')
    .description('Run tests')
    .option(
      '-r, --reporter <reporter>',
      `the Mocha reporter to use, options are [${reporterTypes}]`,
      'spec',
    )
    .action(cmd => runInsomniaTests(getAllOptions(cmd)));

  return test;
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
    .addCommand(makeTestCommand(!!exitOverride))
    .parseAsync(args)
    .catch(err => console.log('An error occurred', err));
}
