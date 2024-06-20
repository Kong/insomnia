import commander from 'commander';
import { parseArgsStringToArgv } from 'string-argv';

import type { ExportSpecificationOptions } from './commands/export-specification';
import { exportSpecification } from './commands/export-specification';
import type { LintSpecificationOptions } from './commands/lint-specification';
import { lintSpecification } from './commands/lint-specification';
import type { RunTestsOptions } from './commands/run-tests';
import { reporterTypes, runInsomniaTests, TestReporter } from './commands/run-tests';
import { getOptions, GlobalOptions } from './get-options';
import { configureLogger, logger } from './logger';
import { exit, getVersion, logErrorExit1 } from './util';

const prepareCommand = (options: Partial<GlobalOptions>) => {
  configureLogger(options.verbose, options.ci);
  options.printOptions && logger.log('Loaded options', options, '\n');
  return options;
};

const makeTestCommand = () => {
  const run = new commander.Command('run').storeOptionsAsProperties(false).description('Execution utilities');
  const defaultReporter: TestReporter = 'spec';
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

const makeLintCommand = () => {
  const lint = new commander.Command('lint').storeOptionsAsProperties(false).description('Linting utilities');
  lint
    .command('spec [identifier]')
    .description('Lint an API Specification')
    .action((identifier, cmd) =>
      exit(lintSpecification(identifier, prepareCommand(getOptions<LintSpecificationOptions>(cmd)))));
  return lint;
};

const makeExportCommand = () => {
  const exportCmd = new commander.Command('export').storeOptionsAsProperties(false).description('Export data from insomnia models');
  exportCmd
    .command('spec [identifier]')
    .description('Export an API Specification to a file')
    .option('-o, --output <path>', 'save the generated config to a file')
    .option('-s, --skipAnnotations', 'remove all "x-kong-" annotations ', false)
    .action((identifier, cmd) =>
      exit(exportSpecification(identifier, prepareCommand(getOptions<ExportSpecificationOptions>(cmd)))));
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
    .action((scriptName: 'lint', cmd) => {
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

export const go = (args?: string[]) => {

  configureLogger();

  // inso
  const cmd = new commander.Command().storeOptionsAsProperties(false);

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
    .addCommand(makeTestCommand())
    .addCommand(makeLintCommand())
    .addCommand(makeExportCommand());

  // Add script base command
  addScriptCommand(cmd);
  runWithArgs(cmd, args || process.argv);
};

const runWithArgs = (cmd: commander.Command, args: string[]) => {
  cmd.parseAsync(args).catch(logErrorExit1);
};
