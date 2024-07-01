import { homedir } from 'node:os';
import path from 'node:path';

import * as commander from 'commander';
import consola, { BasicReporter, FancyReporter, LogLevel, logType } from 'consola';
import { cosmiconfig } from 'cosmiconfig';
import fs from 'fs';
import { generate, runTestsCli } from 'insomnia-testing';
import { parseArgsStringToArgv } from 'string-argv';

import packageJson from '../package.json';
import { exportSpecification, writeFileWithCliOptions } from './commands/export-specification';
import { getRuleSetFileFromFolderByFilename, lintSpecification } from './commands/lint-specification';
import { loadDb } from './db';
import { loadApiSpec, promptApiSpec } from './db/models/api-spec';
import { loadEnvironment, promptEnvironment } from './db/models/environment';
import { loadTestSuites, promptTestSuites } from './db/models/unit-test-suite';
import { loadWorkspace, promptWorkspace } from './db/models/workspace';

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
  exportFile?: string;
} & ConfigFileOptions;
export type TestReporter = 'dot' | 'list' | 'spec' | 'min' | 'progress';
export const reporterTypes: TestReporter[] = ['dot', 'list', 'min', 'progress', 'spec'];
export const reporterTypesSet = new Set(reporterTypes);

export const loadCosmiConfig = async (configFile?: string, workingDir?: string) => {
  try {
    const explorer = await cosmiconfig('inso');
    // set or detect .insorc in workingDir or cwd https://github.com/cosmiconfig/cosmiconfig?tab=readme-ov-file#explorersearch
    const results = configFile ? await explorer.load(configFile) : await explorer.search(workingDir || process.cwd());

    if (results && !results?.isEmpty) {
      logger.debug(`Found config file at ${results?.filepath}.`);
      const scripts = results.config?.scripts || {};
      const filePath = results.filepath;
      const options = ['workingDir', 'ci', 'verbose', 'exportFile', 'printOptions'].reduce((acc, key) => {
        const value = results.config?.options?.[key];
        if (value) {
          return { ...acc, [key]: value };
        }
        return acc;
      }, {});

      return { options, scripts, filePath };
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

export class InsoError extends Error {
  cause?: Error | null;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'InsoError';
    this.cause = cause;
  }
}

/**
 * getAppDataDir returns the data directory for an Electron app,
 * it is equivalent to the app.getPath('userData') API in Electron.
 * https://www.electronjs.org/docs/api/app#appgetpathname
*/
export function getAppDataDir(app: string): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(homedir(), 'Library', 'Application Support', app);
    case 'win32':
      return path.join(process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming'), app);
    case 'linux':
      return path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.config'), app);
    default:
      throw new Error('Unsupported platform');
  }
}
export const getDefaultProductName = (): string => {
  const name = process.env.DEFAULT_APP_NAME;
  if (!name) {
    throw new Error('Environment variable DEFAULT_APP_NAME is not set.');
  }
  return name;
};

export const getAbsoluteFilePath = ({ workingDir, file }: { workingDir?: string; file: string }) => {
  return path.isAbsolute(file) ? file : path.resolve(workingDir || process.cwd(), file);
};
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
const noConsoleLog = async <T>(callback: () => Promise<T>): Promise<T> => {
  const oldConsoleLog = console.log;
  console.log = () => { };
  try {
    return await callback();
  } finally {
    console.log = oldConsoleLog;
  }
};

const localAppDir = getAppDataDir(getDefaultProductName());

export const go = (args?: string[]) => {

  const program = new commander.Command();
  const version = process.env.VERSION || packageJson.version;

  // export and lint logic
  // Provide a path to a file which looks like an insomnia db
  // it may contain multiple workspaces, and specs.
  // you can also just provide a spec file
  // things get confusing when you might have a workingDir a exportFile and an identifier, since they can all be paths to a spec file

  // differences
  // lint can read a .spectral.yml from the folder provided
  // export can remove annotations and output to a file

  program
    .version(version, '-v, --version')
    .description(`A CLI for Insomnia!
  With this tool you can test, lint, and export your Insomnia data.
  Inso will try to detect your locally installed Insomnia data.
  You can also point it at a git repository folder, or an Insomnia export file.

  Examples:
  $ inso run test
  $ inso lint spec
  $ inso export spec


  Inso also supports configuration files, by default it will look for .insorc in the current/provided working directory.
  $ inso export spec --config /some/path/.insorc
`)
    // TODO: make fallback dir clearer
    .option('-w, --workingDir <dir>', 'set working directory, to look for files: .insorc, .insomnia folder, *.db.json', '')
    // TODO: figure out how to remove this option
    .option('--exportFile <file>', 'set the Insomna export file read from', '')
    .option('--verbose', 'show additional logs while running the command', false)
    .option('--ci', 'run in CI, disables all prompts, defaults to false', false)
    .option('--config <path>', 'path to configuration file containing above options', '')
    .option('--printOptions', 'print the loaded options', false);

  const run = program.command('run')
    .description('Execution utilities');

  const defaultReporter: TestReporter = 'spec';
  run.command('test [identifier]')
    .description('Run Insomnia unit test suites, identifier can be a test suite id or a API Spec id')
    .option('-e, --env <identifier>', 'environment to use', '')
    .option('-t, --testNamePattern <regex>', 'run tests that match the regex', '')
    .option(
      '-r, --reporter <reporter>',
      `reporter to use, options are [${reporterTypes.join(', ')}] (default: ${defaultReporter})`, defaultReporter
    )
    .option('-b, --bail', 'abort ("bail") after first test failure', false)
    .option('--keepFile', 'do not delete the generated test file', false)
    .option('--disableCertValidation', 'disable certificate validation for requests with SSL', false)
    .action(async (identifier, cmd: { env: string; testNamePattern: string; reporter: TestReporter; bail: true; keepFile: true; disableCertValidation: true }) => {
      const globals: { config: string; workingDir: string; exportFile: string; ci: boolean; printOptions: boolean; verbose: boolean } = program.optsWithGlobals();
      const commandOptions = { ...globals, ...cmd };
      const __configFile = await loadCosmiConfig(commandOptions.config, commandOptions.workingDir);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      logger.level = options.verbose ? LogLevel.Verbose : LogLevel.Info;
      options.ci && logger.setReporters([new BasicReporter()]);
      options.printOptions && logger.log('Loaded options', options, '\n');
      const useLocalAppData = !options.workingDir && !options.exportFile;
      let pathToSearch = '';
      if (useLocalAppData) {
        logger.warn('No working directory or export file provided, using local app data directory.');
        pathToSearch = localAppDir;
      } else {
        pathToSearch = path.resolve(options.workingDir || process.cwd(), options.exportFile || '');
      }
      if (options.reporter && !reporterTypesSet.has(options.reporter)) {
        logger.fatal(`Reporter "${options.reporter}" not unrecognized. Options are [${reporterTypes.join(', ')}].`);
        return process.exit(1);;
      }

      const db = await loadDb({
        pathToSearch,
        filterTypes: [],
      });

      // Find suites
      const suites = identifier ? loadTestSuites(db, identifier) : await promptTestSuites(db, !!options.ci);

      if (!suites.length) {
        logger.fatal('No test suites found; cannot run tests.');
        return process.exit(1);;
      }

      // Find environment
      const workspaceId = suites[0].parentId;
      const environment = options.env ? loadEnvironment(db, workspaceId, options.env) : await promptEnvironment(db, !!options.ci, workspaceId);

      if (!environment) {
        logger.fatal('No environment identified; cannot run tests without a valid environment.');
        return process.exit(1);;
      }

      try {
        // lazy import
        const { getSendRequestCallbackMemDb } = await import('insomnia-send-request');
        const sendRequest = await getSendRequestCallbackMemDb(environment._id, db, { validateSSL: !options.disableCertValidation });
        // Generate test file
        const testFileContents = generate(suites.map(suite => ({
          name: suite.name,
          suites: [],
          tests: db.UnitTest.filter(test => test.parentId === suite._id)
            .sort((a, b) => a.metaSortKey - b.metaSortKey)
            .map(({ name, code, requestId }) => ({ name, code, defaultRequestId: requestId })),
        })));

        const runTestPromise = runTestsCli(testFileContents, {
          reporter: options.reporter,
          bail: options.bail,
          keepFile: options.keepFile,
          sendRequest,
          testFilter: options.testNamePattern,
        });

        // TODO: is this necessary?
        const success = options.verbose ? await runTestPromise : await noConsoleLog(() => runTestPromise);
        return process.exit(success ? 0 : 1);
      } catch (error) {
        logErrorAndExit(error);
      }
      return process.exit(1);
    });

  run.command('collection [identifier]')
    .description('Run Insomnia request collection, identifier can be a workspace id or request group id')
    .option('-t, --requestNamePattern <regex>', 'run requests that match the regex', '')
    .option('-e, --env <identifier>', 'environment to use', '')
    .option('--disableCertValidation', 'disable certificate validation for requests with SSL', false)
    .action(async (identifier, cmd: { env: string; disableCertValidation: true; requestNamePattern: string }) => {
      const globals: { config: string; workingDir: string; exportFile: string; ci: boolean; printOptions: boolean; verbose: boolean } = program.optsWithGlobals();

      const commandOptions = { ...globals, ...cmd };
      const __configFile = await loadCosmiConfig(commandOptions.config, commandOptions.workingDir);

      const options = {
        reporter: defaultReporter,
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      logger.level = options.verbose ? LogLevel.Verbose : LogLevel.Info;
      options.ci && logger.setReporters([new BasicReporter()]);
      options.printOptions && logger.log('Loaded options', options, '\n');
      let pathToSearch = '';
      const useLocalAppData = !options.workingDir && !options.exportFile;
      if (useLocalAppData) {
        logger.warn('No working directory or export file provided, using local app data directory.');
        pathToSearch = localAppDir;
      } else {
        pathToSearch = path.resolve(options.workingDir || process.cwd(), options.exportFile || '');
      }
      if (options.reporter && !reporterTypesSet.has(options.reporter)) {
        logger.fatal(`Reporter "${options.reporter}" not unrecognized. Options are [${reporterTypes.join(', ')}].`);
        return process.exit(1);
      }

      const db = await loadDb({
        pathToSearch,
        filterTypes: [],
      });

      // Find suites
      const workspace = identifier ? loadWorkspace(db, identifier) : await promptWorkspace(db, !!options.ci);

      if (!workspace) {
        logger.fatal('No workspace found; cannot run requests.');
        return process.exit(1);
      }

      // Find environment
      const workspaceId = workspace._id;
      const environment = options.env ? loadEnvironment(db, workspaceId, options.env) : await promptEnvironment(db, !!options.ci, workspaceId);

      if (!environment) {
        logger.fatal('No environment identified; cannot run requests without a valid environment.');
        return process.exit(1);
      }

      let requests = db.Request.filter(req => req.parentId === workspaceId);
      if (options.requestNamePattern) {
        requests = requests.filter(req => req.name.match(new RegExp(options.requestNamePattern)));
      }
      if (!requests.length) {
        logger.fatal('No requests identified; nothing to run.');
        return process.exit(1);
      }

      try {
        // lazy import
        const { getSendRequestCallbackMemDb } = await import('insomnia-send-request');
        const sendRequest = await getSendRequestCallbackMemDb(environment._id, db, { validateSSL: !options.disableCertValidation });
        let success = true;
        for (const req of requests) {
          if (!success) {
            return;
          }
          logger.log(`Running request: ${req.name} ${req._id}`);
          const res = await sendRequest(req._id);
          // TODO: use logging levels
          options.verbose && logger.info(res);
          if (res.status !== 200) {
            success = false;
            logger.error(`Request failed with status ${res.status}`);
          }
        }
        return process.exit(success ? 0 : 1);
      } catch (error) {
        logErrorAndExit(error);
      }
      return process.exit(1);
    });

  program.command('lint')
    .description('Linting utilities')
    .command('spec [identifier]')
    .description('Lint an API Specification, identifier can be an API Spec id or a file path')
    .action(async identifier => {
      const globals: { config: string; workingDir: string; exportFile: string; ci: boolean; printOptions: boolean; verbose: boolean } = program.optsWithGlobals();

      const commandOptions = globals;
      const __configFile = await loadCosmiConfig(commandOptions.config, commandOptions.workingDir);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      logger.level = options.verbose ? LogLevel.Verbose : LogLevel.Info;
      options.ci && logger.setReporters([new BasicReporter()]);
      let pathToSearch = '';
      const useLocalAppData = !options.workingDir && !options.exportFile;
      if (useLocalAppData) {
        logger.warn('No working directory or export file provided, using local app data directory.');
        pathToSearch = localAppDir;
      } else {
        pathToSearch = path.resolve(options.workingDir || process.cwd(), options.exportFile || '');
      }
      const db = await loadDb({
        pathToSearch,
        filterTypes: ['ApiSpec'],
      });
      if (!db.ApiSpec.length) {
        logger.fatal(`Specification not found in data at: ${pathToSearch}`);
        return process.exit(1);
      }
      const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, options.ci);
      let specContent = specFromDb?.contents;
      let rulesetFileName;
      if (!specContent && identifier) {
        // try load as a file
        const fileName = getAbsoluteFilePath({ workingDir: options.workingDir, file: identifier });
        logger.trace(`Linting specification from idenfitier: \`${fileName}\``);
        specContent = await fs.promises.readFile(fileName, 'utf-8');
        rulesetFileName = await getRuleSetFileFromFolderByFilename(fileName);
      }
      if (!specContent) {
        logger.fatal('Specification content not found at: ' + pathToSearch);
        return process.exit(1);
      }

      try {
        const { isValid } = await lintSpecification({ specContent, rulesetFileName });
        return process.exit(isValid ? 0 : 1);
      } catch (error) {
        logErrorAndExit(error);
      }
      return process.exit(1);
    });

  program.command('export').description('Export data from insomnia models')
    .command('spec [identifier]')
    .description('Export an API Specification to a file, identifier can be an API Spec id or a file path')
    .option('-o, --output <path>', 'save the generated config to a file', '')
    .option('-s, --skipAnnotations', 'remove all "x-kong-" annotations, defaults to false', false)
    .action(async (identifier, cmd: { output: string; skipAnnotations: boolean }) => {
      const globals: { config: string; workingDir: string; exportFile: string; ci: boolean; printOptions: boolean; verbose: boolean } = program.optsWithGlobals();

      const commandOptions = { ...globals, ...cmd };
      const __configFile = await loadCosmiConfig(commandOptions.config, commandOptions.workingDir);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      options.printOptions && logger.log('Loaded options', options, '\n');
      let pathToSearch = '';
      const useLocalAppData = !options.workingDir && !options.exportFile;
      if (useLocalAppData) {
        logger.warn('No working directory or export file provided, using local app data directory.');
        pathToSearch = localAppDir;
      } else {
        pathToSearch = path.resolve(options.workingDir || process.cwd(), options.exportFile || '');
      }
      const db = await loadDb({
        pathToSearch,
        filterTypes: ['ApiSpec'],
      });
      if (!db.ApiSpec.length) {
        logger.fatal(`Specification not found in data at: ${pathToSearch}`);
        return process.exit(1);
      }
      const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, !!options.ci);
      if (!specFromDb?.contents) {
        logger.fatal('Specification content not found at: ' + pathToSearch);
        return process.exit(1);
      }
      try {
        const specContent = await exportSpecification({
          specContent: specFromDb.contents,
          skipAnnotations: options.skipAnnotations,
        });
        const outputPath = options.output && getAbsoluteFilePath({ workingDir: options.workingDir, file: options.output });
        if (!outputPath) {
          logger.log(specContent);
          return process.exit(0);
        }
        const filePath = await writeFileWithCliOptions(outputPath, specContent);
        logger.log(`Specification exported to "${filePath}".`);
        return process.exit(0);
      } catch (error) {
        logErrorAndExit(error);
      }
      return process.exit(1);
    });

  // Add script base command
  program.command('script <script-name>')
    .description('Run scripts defined in .insorc')
    .allowUnknownOption()
    .action(async (scriptName: string, cmd) => {
      const commandOptions = { ...program.optsWithGlobals(), ...cmd };
      // TODO: getAbsolutePath to working directory and use it to check from config file
      const __configFile = await loadCosmiConfig(commandOptions.config, commandOptions.workingDir);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
        ...(__configFile ? { __configFile } : {}),
      };
      logger.level = options.verbose ? LogLevel.Verbose : LogLevel.Info;
      options.ci && logger.setReporters([new BasicReporter()]);
      options.printOptions && logger.log('Loaded options', options, '\n');

      const scriptTask = options.__configFile?.scripts?.[scriptName];

      if (!scriptTask) {
        logger.fatal(`Could not find inso script "${scriptName}" in the config file.`);
        return process.exit(1);
      }

      if (!scriptTask.startsWith('inso')) {
        logger.fatal('Tasks in a script should start with `inso`.');
        return process.exit(1);
      }

      // Get args after script name
      const passThroughArgs = program.args.slice(program.args.indexOf(scriptName) + 1);
      const scriptArgs: string[] = parseArgsStringToArgv(
        `self ${scriptTask} ${passThroughArgs.join(' ')}`,
      );

      logger.debug(`>> ${scriptArgs.slice(1).join(' ')}`);

      program.parseAsync(scriptArgs).catch(logErrorAndExit);
    });

  program.parseAsync(args || process.argv).catch(logErrorAndExit);
};
