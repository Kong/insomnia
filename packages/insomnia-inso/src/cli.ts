import commander from 'commander';
import { parseArgsStringToArgv } from 'string-argv';

import type { ExportSpecificationOptions } from './commands/export-specification';
import { exportSpecification } from './commands/export-specification';
import type { GenerateConfigOptions } from './commands/generate-config';
import { ConversionOption, conversionOptions, generateConfig } from './commands/generate-config';
import type { LintSpecificationOptions } from './commands/lint-specification';
import { lintSpecification } from './commands/lint-specification';
import type { RunTestsOptions } from './commands/run-tests';
import { reporterTypes, runInsomniaTests, TestReporter } from './commands/run-tests';
import { getOptions } from './get-options';
import { configureLogger, logger } from './logger';
import { UNKNOWN_OBJ } from './types';
import { exit, getVersion, logErrorExit1 } from './util';

const prepareCommand = (options: Partial<GenerateConfigOptions>) => {
  configureLogger(options.verbose, options.ci);
  options.printOptions && logger.log('Loaded options', options, '\n');
  return options;
};

type CreateCommand = (command: string) => commander.Command;

const makeGenerateCommand = (commandCreator: CreateCommand) => {
  // inso generate
  const command = commandCreator('generate').description('Code generation utilities');
  const defaultType: ConversionOption = 'declarative';

  // inso generate config -t kubernetes config.yaml
  command
    .command('config [identifier]')
    .description('Generate configuration from an api spec.')
    .option(
      '-t, --type <value>',
      `type of configuration to generate, options are [${conversionOptions.join(', ')}] (default: ${defaultType})`,
    )
    .option('--tags <tags>', 'comma separated list of tags to apply to each entity')
    .option('-o, --output <path>', 'save the generated config to a file')
    .action((identifier, cmd) => {
      let options = getOptions<GenerateConfigOptions>(cmd, {
        type: defaultType,
      });
      options = prepareCommand(options);
      return exit(generateConfig(identifier, options));
    });
  return command;
};

const makeTestCommand = (commandCreator: CreateCommand) => {
  // inso run
  const run = commandCreator('run').description('Execution utilities');
  const defaultReporter: TestReporter = 'spec';

  // inso run tests
  run
    .command('test [identifier]')
    .description('Run Insomnia unit test suites')
    .option('-e, --env <identifier>', 'environment to use')
    .option('-t, --testNamePattern <regex>', 'run tests that match the regex')
    .option(
      '-r, --reporter <reporter>',
      `reporter to use, options are [${reporterTypes.join(', ')}] (default: ${defaultReporter})`,
    )
    .option('-b, --bail', 'abort ("bail") after first test failure')
    .option('--keepFile', 'do not delete the generated test file')
    .option('--disableCertValidation', 'disable certificate validation for requests with SSL')
    .action((identifier, cmd) => {
      let options = getOptions<RunTestsOptions>(cmd, {
        reporter: defaultReporter,
      });
      options = prepareCommand(options);
      return exit(runInsomniaTests(identifier, options));
    });
  return run;
};

const makeLintCommand = (commandCreator: CreateCommand) => {
  // inso lint
  const lint = commandCreator('lint').description('Linting utilities');

  // inso lint spec
  lint
    .command('spec [identifier]')
    .description('Lint an API Specification')
    .action((identifier, cmd) => {
      let options = getOptions<LintSpecificationOptions>(cmd);
      options = prepareCommand(options);
      return exit(lintSpecification(identifier, options));
    });
  return lint;
};

const makeExportCommand = (commandCreator: CreateCommand) => {
  // inso export
  const exportCmd = commandCreator('export').description('Export data from insomnia models');

  // inso export spec
  exportCmd
    .command('spec [identifier]')
    .description('Export an API Specification to a file')
    .option('-o, --output <path>', 'save the generated config to a file')
    .action((identifier, cmd) => {
      let options = getOptions<ExportSpecificationOptions>(cmd);
      options = prepareCommand(options);
      return exit(exportSpecification(identifier, options));
    });
  return exportCmd;
};

const addScriptCommand = (originalCommand: commander.Command) => {
  // inso script
  originalCommand
    .command('script <name>', {
      isDefault: true,
    })
    .description('Run scripts defined in .insorc')
    .allowUnknownOption()
    // @ts-expect-error this appears to actually be valid, and I don't want to risk changing any behavior
    .action((scriptName, cmd) => {
      // Load scripts
      let options = getOptions(cmd);
      options = prepareCommand(options);

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
      const scriptArgs: string[] = parseArgsStringToArgv(
        `self ${scriptTask} ${passThroughArgs.join(' ')}`,
      );

      // Print command
      logger.debug(`>> ${scriptArgs.slice(1).join(' ')}`); // Run

      runWithArgs(originalCommand, scriptArgs);
    });
};

export const go = (args?: string[], exitOverride?: boolean) => {
  const commandCreator = (cmd?: string) => {
    const command = new commander.Command(cmd).storeOptionsAsProperties(false);

    if (exitOverride) {
      command.exitOverride();
    }

    return command;
  };

  configureLogger();

  // inso
  const cmd = commandCreator();

  // Version and description
  cmd
    .version(getVersion(), '-v, --version')
    .description('A CLI for Insomnia!');

  // Global options
  cmd
    .option('-w, --workingDir <dir>', 'set working directory')
    .option('-a, --appDataDir <dir>', 'set the app data directory (deprecated; use --src instead)')
    .option('--config <path>', 'path to configuration file')
    .option('--verbose', 'show additional logs while running the command')
    .option('--src <file|dir>', 'set the app data source')
    .option('--printOptions', 'print the loaded options')
    .option('--ci', 'run in CI, disables all prompts');

  // Add commands and sub commands
  cmd
    .addCommand(makeGenerateCommand(commandCreator))
    .addCommand(makeTestCommand(commandCreator))
    .addCommand(makeLintCommand(commandCreator))
    .addCommand(makeExportCommand(commandCreator));

  // Add script base command
  addScriptCommand(cmd);
  runWithArgs(cmd, args || process.argv);
};

const runWithArgs = (
  cmd: UNKNOWN_OBJ,
  args: string[],
) => {
  cmd.parseAsync(args).catch(logErrorExit1);
};
