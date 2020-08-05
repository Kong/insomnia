// @flow
import { ConversionTypeMap, generateConfig } from './commands/generate-config';
import { getVersion, logErrorExit1, exit } from './util';
import { runInsomniaTests, TestReporterEnum } from './commands/run-tests';
import { lintSpecification } from './commands/lint-specification';
import { exportSpecification } from './commands/export-specification';
import { parseArgsStringToArgv } from 'string-argv';
import commander from 'commander';
import getOptions from './get-options';
import logger, { configureLogger } from './logger';
import type { GenerateConfigOptions } from './commands/generate-config';
import type { RunTestsOptions } from './commands/run-tests';
import type { LintSpecificationOptions } from './commands/lint-specification';
import type { ExportSpecificationOptions } from './commands/export-specification';
import type { GlobalOptions } from './get-options';

type CreateCommandType = (command?: string, options?: Object) => Object;

function prepareCommand(options: $Shape<GlobalOptions>): void {
  configureLogger(options.verbose, options.ci);
  options.printOptions && logger.log(`Loaded options`, options, '\n');
}

function makeGenerateCommand(createCommand: CreateCommandType) {
  // inso generate
  const generate = createCommand('generate').description('Code generation utilities');

  const conversionTypes = Object.keys(ConversionTypeMap).join(', ');

  const defaultType = 'declarative';
  // inso generate config -t kubernetes config.yaml
  generate
    .command('config [identifier]')
    .description('Generate configuration from an api spec.')
    .option(
      '-t, --type <value>',
      `type of configuration to generate, options are [${conversionTypes}] (default: ${defaultType})`,
    )
    .option('-o, --output <path>', 'save the generated config to a file')
    .action((identifier, cmd) => {
      const options = getOptions<GenerateConfigOptions>(cmd, { type: defaultType });
      prepareCommand(options);
      return exit(generateConfig(identifier, options));
    });

  return generate;
}

function makeTestCommand(createCommand: CreateCommandType) {
  // inso run
  const run = createCommand('run').description('Execution utilities');

  const reporterTypes = Object.keys(TestReporterEnum).join(', ');

  const defaultReporter = TestReporterEnum.spec;
  // inso run tests
  run
    .command('test [identifier]')
    .description('Run Insomnia unit test suites')
    .option('-e, --env <identifier>', 'environment to use')
    .option('-t, --testNamePattern <regex>', 'run tests that match the regex')
    .option(
      '-r, --reporter <reporter>',
      `reporter to use, options are [${reporterTypes}] (default: ${defaultReporter})`,
    )
    .option('-b, --bail', 'abort ("bail") after first test failure')
    .option('--keepFile', 'do not delete the generated test file')
    .action((identifier, cmd) => {
      const options = getOptions<RunTestsOptions>(cmd, { reporter: defaultReporter });
      prepareCommand(options);
      return exit(runInsomniaTests(identifier, options));
    });

  return run;
}

function makeLintCommand(createCommand: CreateCommandType) {
  // inso lint
  const lint = createCommand('lint').description('Linting utilities');

  // inso lint spec
  lint
    .command('spec [identifier]')
    .description('Lint an API Specification')
    .action((identifier, cmd) => {
      const options = getOptions<LintSpecificationOptions>(cmd);
      prepareCommand(options);
      return exit(lintSpecification(identifier, options));
    });

  return lint;
}

function makeExportCommand(createCommand: CreateCommandType) {
  // inso export
  const exportCmd = createCommand('export').description('Export data from insomnia models');

  // inso export spec
  exportCmd
    .command('spec [identifier]')
    .description('Export an API Specification to a file')
    .option('-o, --output <path>', 'save the generated config to a file')
    .action((identifier, cmd) => {
      const options = getOptions<ExportSpecificationOptions>(cmd);
      prepareCommand(options);
      return exit(exportSpecification(identifier, options));
    });

  return exportCmd;
}

function addScriptCommand(originalCommand: Object) {
  // inso script
  originalCommand
    .command('script <name>', { isDefault: true })
    .description('Run scripts defined in .insorc')
    .allowUnknownOption()
    .action((scriptName, cmd) => {
      // Load scripts
      const options = getOptions(cmd);
      prepareCommand(options);

      // Ignore the first arg because that will be scriptName, get the rest
      const passThroughArgs = cmd.args.slice(1);

      // Find script
      const scriptTask = options.__configFile?.scripts?.[scriptName];

      if (!scriptTask) {
        logger.fatal(`Could not find inso script "${scriptName}" in the config file.`);
        return exit(new Promise(resolve => resolve(false)));
      }

      if (!scriptTask.startsWith('inso')) {
        logger.fatal('Tasks in a script should start with `inso`.');
        return exit(new Promise(resolve => resolve(false)));
      }

      // Collect args
      const scriptArgs: Array<string> = parseArgsStringToArgv(
        `self ${scriptTask} ${passThroughArgs.join(' ')}`,
      );

      // Print command
      logger.debug(`>> ${scriptArgs.slice(1).join(' ')}`);

      // Run
      runWithArgs(originalCommand, scriptArgs);
    });
}

export function go(args?: Array<string>, exitOverride?: boolean): void {
  const createCommand: CreateCommandType = (cmd?: string) => {
    const command = new commander.Command(cmd).storeOptionsAsProperties(false);

    if (exitOverride) {
      command.exitOverride();
    }

    return command;
  };

  configureLogger();

  // inso
  const cmd = createCommand();

  // Version and description
  cmd.version(getVersion(), '-v, --version').description('A CLI for Insomnia!');

  // Global options
  cmd
    .option('-w, --workingDir <dir>', 'set working directory')
    .option('-a, --appDataDir <dir>', 'set the app data directory')
    .option('--config <path>', 'path to configuration file')
    .option('--verbose', 'show additional logs while running the command')
    .option('--printOptions', 'print the loaded options')
    .option('--ci', 'run in CI, disables all prompts');

  // Add commands and sub commands
  cmd
    .addCommand(makeGenerateCommand(createCommand))
    .addCommand(makeTestCommand(createCommand))
    .addCommand(makeLintCommand(createCommand))
    .addCommand(makeExportCommand(createCommand));

  // Add script base command
  addScriptCommand(cmd);

  runWithArgs(cmd, args || process.argv);
}

function runWithArgs(cmd: Object, args: Array<string>) {
  cmd.parseAsync(args).catch(logErrorExit1);
}
