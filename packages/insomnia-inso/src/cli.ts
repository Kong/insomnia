import * as commander from 'commander';
import parseArgsStringToArgv from 'string-argv';

import packageJson from '../package.json';
import { exportSpecification } from './commands/export-specification';
import { lintSpecification } from './commands/lint-specification';
import { reporterTypes, runInsomniaTests, TestReporter } from './commands/run-tests';
import { getOptions, GlobalOptions } from './get-options';
import { configureLogger, logger } from './logger';
import { exit, InsoError } from './util';

const prepareCommand = (options: Partial<GlobalOptions>) => {
  configureLogger(options.quiet, options.ci);
  options.printOptions && logger.log('Loaded options', options, '\n');
  return options;
};

export const go = (args?: string[]) => {
  configureLogger();
  const program = new commander.Command().storeOptionsAsProperties(false);
  program
    .version(process.env.VERSION || packageJson.version, '-v, --version')
    .description('A CLI for Insomnia!');
  // Global options
  program
    .configureHelp({ showGlobalOptions: true })
    .option('-w, --workingDir <dir>', 'set working directory', '.')
    .option('--config <path>', 'path to configuration file')
    .option('--quiet', 'hide logs')
    .option('--src <file|dir>', 'set the app data source, this is where your insomnia database lives')
    .option('--printOptions', 'print the loaded options')
    .option('--ci', 'run in CI, disables all prompts');
  program
    .command('export spec [identifier]')
    .description('Export an API Specification to a file')
    .option('-o, --output <path>', 'save the generated config to a file, defaults to stdout')
    .option('-s, --skipAnnotations', 'remove all "x-kong-" annotations ', false)
    .action((_, identifier, cmd) => {
      const globals = program.optsWithGlobals();
      return exit(exportSpecification(identifier, prepareCommand(getOptions({ ...globals, ...cmd }))));
    });
  program
    .command('lint spec [identifier]')
    .description('Lint an API Specification')
    .action((_, identifier, cmd) => {
      const globals = program.optsWithGlobals();
      return exit(lintSpecification(identifier, prepareCommand(getOptions({ ...globals, ...cmd }))));
    });
  const defaultReporter: TestReporter = 'spec';
  program
    .command('run test [identifier]')
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
    .action((_, identifier, cmd) => {
      const globals = program.optsWithGlobals();
      return exit(runInsomniaTests(identifier, prepareCommand(getOptions({ reporter: defaultReporter, ...globals, ...cmd }))));
    });
  program
    .command('script <name>', {
      isDefault: true,
    })
    .description('Run scripts defined in .insorc')
    .allowUnknownOption()
    // @ts-expect-error this appears to actually be valid, and I don't want to risk changing any behavior
    .action((scriptName: 'lint', cmd) => {
      const globals = program.optsWithGlobals();
      const scriptTask = prepareCommand(getOptions({ ...globals, ...cmd })).__configFile?.scripts?.[scriptName];
      if (!scriptTask) {
        logger.fatal(`Could not find inso script "${scriptName}" in the config file.`);
        return exit(new Promise(resolve => resolve(false)));
      }
      if (!scriptTask.startsWith('inso')) {
        logger.fatal('Tasks in a script must start with `inso`.');
        return exit(new Promise(resolve => resolve(false)));
      }
      // Collect args, Ignore the first arg because that will be scriptName, get the rest
      const scriptArgs: string[] = parseArgsStringToArgv(
        `self ${scriptTask} ${program.args.slice(1).join(' ')}`,
      );
      // Print command
      logger.debug(`>> ${scriptArgs.slice(1).join(' ')}`); // Run

      // program.parseAsync(scriptArgs).catch(err => {
      //   if (err instanceof InsoError) {
      //     logger.fatal(err.message);
      //     err.cause && logger.fatal(err.cause);
      //   } else if (err) {
      //     logger.fatal(err);
      //   }
      //   process.exit(1);
      // });
    });
  program.parseAsync(args || process.argv).catch(err => {
    if (err instanceof InsoError) {
      logger.fatal(err.message);
      err.cause && logger.fatal(err.cause);
    } else if (err) {
      logger.fatal(err);
    }
    process.exit(1);
  });
};
