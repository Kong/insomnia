// @flow
import { ConversionTypeMap, generateConfig } from './commands/generate-config';
import { getVersion, createCommand, getAllOptions, logErrorExit1, exit } from './util';
import { runInsomniaTests, TestReporterEnum } from './commands/run-tests';
import { lintSpecification } from './commands/lint-specification';

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
      `type of configuration to generate, options are [${conversionTypes}]`,
    )
    .option('-o, --output <path>', 'save the generated config to a file')
    .action((identifier, cmd) => exit(generateConfig(identifier, getAllOptions(cmd))));

  return generate;
}

function makeTestCommand(exitOverride: boolean) {
  // inso run
  const run = createCommand(exitOverride, 'run').description('Execution utilities');

  const reporterTypes = Object.keys(TestReporterEnum).join(', ');

  // inso run tests
  run
    .command('test')
    .description('Run Insomnia unit tests')
    .option(
      '-r, --reporter <reporter>',
      `reporter to use, options are [${reporterTypes}]`,
      TestReporterEnum.spec,
    )
    .option('-b, --bail', 'abort ("bail") after first test failure')
    .option('--keep-file', 'do not delete the generated test file')
    .action(cmd => exit(runInsomniaTests(getAllOptions(cmd))));

  return run;
}

function makeLintCommand(exitOverride: boolean) {
  // inso lint
  const lint = createCommand(exitOverride, 'lint').description('Linting utilities');

  // inso lint spec
  lint
    .command('spec <identifier>')
    .description('Lint an API Specification')
    .action((identifier, cmd) => exit(lintSpecification(identifier, getAllOptions(cmd))));

  return lint;
}

export function go(args?: Array<string>, exitOverride?: boolean): void {
  if (!args) {
    args = process.argv;
  }

  // inso -v
  createCommand(!!exitOverride)
    .version(getVersion(), '-v, --version')
    .description('A CLI for Insomnia!')
    .option('--working-dir <dir>', 'set working directory')
    .addCommand(makeGenerateCommand(!!exitOverride))
    .addCommand(makeTestCommand(!!exitOverride))
    .addCommand(makeLintCommand(!!exitOverride))
    .parseAsync(args)
    .catch(logErrorExit1);
}
