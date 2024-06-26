import commander from 'commander';
import consola, { BasicReporter, FancyReporter, LogLevel, logType } from 'consola';
import { cosmiconfigSync } from 'cosmiconfig';
import { parseArgsStringToArgv } from 'string-argv';

import packageJson from '../package.json';
import type { ExportSpecificationOptions } from './commands/export-specification';
import { exportSpecification } from './commands/export-specification';
import type { LintSpecificationOptions } from './commands/lint-specification';
import { lintSpecification } from './commands/lint-specification';
import type { RunTestsOptions } from './commands/run-tests';
import { reporterTypes, runInsomniaTests, TestReporter } from './commands/run-tests';

interface ConfigFileOptions {
  __configFile?: {
    options?: GlobalOptions;
    scripts?: {
      lint: string;
    };
    filePath: string;
  };
}

export type GlobalOptions = {
  workingDir?: string;
  ci?: boolean;
  verbose?: boolean;
  printOptions?: boolean;
  config?: string;
  src?: string;
} & ConfigFileOptions;

export const OptionsSupportedInConfigFile: (keyof GlobalOptions)[] = [
  'workingDir',
  'ci',
  'verbose',
  'src',
  'printOptions',
];

export const loadCosmiConfig = (configFile?: string): Partial<ConfigFileOptions> => {
  try {
    const explorer = cosmiconfigSync('inso');
    const results = configFile ? explorer.load(configFile) : explorer.search();

    if (results && !results?.isEmpty) {
      const options: GlobalOptions = {};
      OptionsSupportedInConfigFile.forEach(key => {
        const value = results.config?.options?.[key];

        if (value) {
          options[key] = value;
        }
      });
      return {
        __configFile: {
          options,
          scripts: results.config?.scripts || {},
          filePath: results.filepath,
        },
      };
    }
  } catch (error) {
    // Report fatal error when loading from explicitly defined config file
    if (configFile) {
      console.log(`Could not find config file at ${configFile}.`);
      console.error(error);
    }
  }

  return {};
};

interface CommandObj {
  parent?: CommandObj;
  opts: () => GlobalOptions;
}

export const extractCommandOptions = <T extends GlobalOptions>(cmd: CommandObj): Partial<T> => {
  let opts: Partial<T> = {};
  let command: CommandObj | undefined = cmd;

  do {
    // overwrite options with more specific ones
    opts = { ...command.opts(), ...opts };
    command = command.parent;
  } while (command);

  return opts;
};

export const getOptions = <T extends Partial<GlobalOptions>>(cmd: CommandObj, defaultOptions: Partial<T> = {}): Partial<T> => {
  const commandOptions = extractCommandOptions(cmd);
  const { __configFile } = loadCosmiConfig(commandOptions.config);

  if (__configFile) {
    return {
      ...defaultOptions,
      ...(__configFile.options || {}),
      ...commandOptions,
      __configFile,
    };
  }

  return {
    ...defaultOptions,
    ...commandOptions,
  };
};

export const noConsoleLog = async <T>(callback: () => Promise<T>): Promise<T> => {
  const oldConsoleLog = console.log;

  console.log = () => { };

  try {
    return await callback();
  } finally {
    console.log = oldConsoleLog;
  }
};

export type LogsByType = {
  [t in logType]?: string[]
};

export type ModifiedConsola = ReturnType<typeof consola.create> & { __getLogs: () => LogsByType };

const consolaLogger = consola.create({
  reporters: [
    new FancyReporter({
      formatOptions: {
        // @ts-expect-error something is wrong here, ultimately these types come from https://nodejs.org/api/util.html#util_util_inspect_object_options and `date` doesn't appear to be one of the options.
        date: false,
      },
    }),
  ],
});

(consolaLogger as ModifiedConsola).__getLogs = () => ({});

export const logger = consolaLogger as ModifiedConsola;

export const configureLogger = (verbose = false, ci = false) => {
  logger.level = verbose ? LogLevel.Verbose : LogLevel.Info;

  if (ci) {
    logger.setReporters([new BasicReporter()]);
  }
};
export class InsoError extends Error {
  cause?: Error | null;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'InsoError';
    this.cause = cause;
  }
}

export const handleError = (err?: Error) => {
  if (err instanceof InsoError) {
    logger.fatal(err.message);
    err.cause && logger.fatal(err.cause);
  } else if (err) {
    logger.fatal(err);
  }

  logger.info('To view tracing information, re-run `inso` with `--verbose`');
};

export const logErrorExit1 = (err?: Error) => {
  handleError(err);
  process.exit(1);
};

export const exit = async (result: Promise<boolean>): Promise<void> => {
  return result.then(r => process.exit(r ? 0 : 1)).catch(logErrorExit1);
};

const prepareCommand = (options: Partial<GlobalOptions>) => {
  configureLogger(options.verbose, options.ci);
  options.printOptions && logger.log('Loaded options', options, '\n');
  return options;
};

type CreateCommand = (command: string) => commander.Command;

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
    .option('-s, --skipAnnotations', 'remove all "x-kong-" annotations ', false)
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
      return;
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
  const version = process.env.VERSION || packageJson.version;

  // Version and description
  cmd
    .version(version, '-v, --version')
    .description(`A CLI for Insomnia!
  With this tool you can lint, test and export your Insomnia data.
  It can read from three data sources, but will use local Insomnia application data as a default:
    - Insomnia data directory (~/.config/Insomnia/)
    - Insomnia export file (eg. export.json)
    - Git repository (~/git/myproject)
`);

  // Global options
  cmd
    .option('-w, --workingDir <dir>', 'set working directory')
    .option('--src <file>', 'set the file read from, defaults to installed Insomnia data directory')
    .option('--verbose', 'show additional logs while running the command')
    .option('--ci', 'run in CI, disables all prompts')
    .option('--config <path>', 'path to configuration file containing above options')
    .option('--printOptions', 'print the loaded options');

  // Add commands and sub commands
  cmd
    .addCommand(makeTestCommand(commandCreator))
    .addCommand(makeLintCommand(commandCreator))
    .addCommand(makeExportCommand(commandCreator));

  // Add script base command
  addScriptCommand(cmd);
  runWithArgs(cmd, args || process.argv);
};

const runWithArgs = (cmd: commander.Command, args: string[]) => {
  cmd.parseAsync(args).catch(logErrorExit1);
};
