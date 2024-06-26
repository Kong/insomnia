import * as commander from 'commander';
import consola, { BasicReporter, FancyReporter, LogLevel, logType } from 'consola';
import { cosmiconfig } from 'cosmiconfig';
import { parseArgsStringToArgv } from 'string-argv';

import packageJson from '../package.json';
import { exportSpecification } from './commands/export-specification';
import { lintSpecification } from './commands/lint-specification';
import { reporterTypes, runInsomniaTests, TestReporter } from './commands/run-tests';

interface ConfigFileOptions {
  __configFile?: {
    options: GlobalOptions;
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

export const loadCosmiConfig = async (configFile?: string) => {
  try {
    const explorer = await cosmiconfig('inso');
    const results = configFile ? await explorer.load(configFile) : await explorer.search();

    if (results && !results?.isEmpty) {
      logger.debug(`Found config file at ${results?.filepath}.`);
      const scripts = results.config?.scripts || {};
      const filePath = results.filepath;
      const options: GlobalOptions = OptionsSupportedInConfigFile.reduce((acc, key) => {
        const value = results.config?.options?.[key];
        if (value) {
          return { ...acc, [key]: value };
        }
        return acc;
      }, {});

      return { __configFile: { options, scripts, filePath } };
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

export const logErrorAndExit = (err?: Error) => {
  if (err instanceof InsoError) {
    logger.fatal(err.message);
    err.cause && logger.fatal(err.cause);
  } else if (err) {
    logger.fatal(err);
  }

  logger.info('To view tracing information, re-run `inso` with `--verbose`');
  process.exit(1);
};

const addScriptCommand = (originalCommand: commander.Command) => {
  // inso script
  originalCommand
    .command('script <script-name>', {
      isDefault: true,
    })
    .description('Run scripts defined in .insorc')
    .allowUnknownOption()
    .action(async (scriptName: 'lint', cmd) => {
      const commandOptions = { ...originalCommand.optsWithGlobals(), ...cmd };
      const { __configFile } = await loadCosmiConfig(commandOptions.config);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      configureLogger(options.verbose, options.ci);
      options.printOptions && logger.log('Loaded options', options, '\n');

      // Ignore the first arg because that will be scriptName, get the rest
      const passThroughArgs = originalCommand.args.slice(1);

      // Find script
      const scriptTask = options.__configFile?.scripts?.[scriptName];

      if (!scriptTask) {
        logger.fatal(`Could not find inso script "${scriptName}" in the config file.`);
        return process.exit(1);

      }

      if (!scriptTask.startsWith('inso')) {
        logger.fatal('Tasks in a script should start with `inso`.');
        return process.exit(1);
      }

      const scriptArgs: string[] = parseArgsStringToArgv(
        `self ${scriptTask} ${passThroughArgs.join(' ')}`,
      );

      logger.debug(`>> ${scriptArgs.slice(1).join(' ')}`);

      originalCommand.parseAsync(scriptArgs).catch(logErrorAndExit);
      return;
    });
};

export const go = (args?: string[], exitOverride?: boolean) => {
  const commandCreator = (cmd?: string) => {
    const command = new commander.Command(cmd);

    if (exitOverride) {
      command.exitOverride();
    }

    return command;
  };

  configureLogger();

  const program = commandCreator();
  const version = process.env.VERSION || packageJson.version;

  program
    .version(version, '-v, --version')
    .description(`A CLI for Insomnia!
  With this tool you can lint, test and export your Insomnia data.
  It can read from three data sources, but will use local Insomnia application data as a default:
    - Insomnia data directory (~/.config/Insomnia/)
    - Insomnia export file (eg. export.json)
    - Git repository (~/git/myproject)
`);

  // Global options
  program
    .option('-w, --workingDir <dir>', 'set working directory')
    .option('--src <file>', 'set the file read from, defaults to installed Insomnia data directory')
    .option('--verbose', 'show additional logs while running the command')
    .option('--ci', 'run in CI, disables all prompts')
    .option('--config <path>', 'path to configuration file containing above options')
    .option('--printOptions', 'print the loaded options');

  const run = commandCreator('run').description('Execution utilities');
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
    .action(async (identifier, cmd) => {
      const commandOptions = { ...program.optsWithGlobals(), ...cmd };
      const { __configFile } = await loadCosmiConfig(commandOptions.config);

      const options = {
        reporter: defaultReporter,
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      configureLogger(options.verbose, options.ci);
      options.printOptions && logger.log('Loaded options', options, '\n');

      return runInsomniaTests(identifier, options)
        .then(success => process.exit(success ? 0 : 1)).catch(logErrorAndExit);
    });

  const lint = commandCreator('lint').description('Linting utilities');
  lint
    .command('spec [identifier]')
    .description('Lint an API Specification')
    .action(async (identifier, cmd) => {
      const commandOptions = { ...program.optsWithGlobals(), ...cmd };
      const { __configFile } = await loadCosmiConfig(commandOptions.config);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      configureLogger(options.verbose, options.ci);
      return lintSpecification(identifier, options)
        .then(success => process.exit(success ? 0 : 1)).catch(logErrorAndExit);
    });

  const exportCmd = commandCreator('export').description('Export data from insomnia models');
  exportCmd
    .command('spec [identifier]')
    .description('Export an API Specification to a file')
    .option('-o, --output <path>', 'save the generated config to a file')
    .option('-s, --skipAnnotations', 'remove all "x-kong-" annotations ', false)
    .action(async (identifier, cmd) => {
      const commandOptions = { ...program.optsWithGlobals(), ...cmd };
      const { __configFile } = await loadCosmiConfig(commandOptions.config);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      options.printOptions && logger.log('Loaded options', options, '\n');
      return exportSpecification(identifier, options)
        .then(success => process.exit(success ? 0 : 1)).catch(logErrorAndExit);
    });

  program
    .addCommand(run)
    .addCommand(lint)
    .addCommand(exportCmd);

  // Add script base command
  addScriptCommand(program);
  program.parseAsync(args || process.argv).catch(logErrorAndExit);
};
