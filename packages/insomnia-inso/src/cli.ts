import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import * as commander from 'commander';
import type { logType } from 'consola';
import consola, { BasicReporter, FancyReporter, LogLevel } from 'consola';
import { cosmiconfig } from 'cosmiconfig';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from 'insomnia/src/common/constants';
import { getSendRequestCallbackMemDb } from 'insomnia/src/common/send-request';
import type { UserUploadEnvironment } from 'insomnia/src/models/environment';
import { init, type as EnvironmentType } from 'insomnia/src/models/environment';
import type { Request } from 'insomnia/src/models/request';
import type { RequestGroup } from 'insomnia/src/models/request-group';
import { deserializeNDJSON } from 'insomnia/src/utils/ndjson';
import { generate, runTestsCli } from 'insomnia-testing';
import orderedJSON from 'json-order';
import { parseArgsStringToArgv } from 'string-argv';
import { v4 as uuidv4 } from 'uuid';

import { type RequestTestResult } from '../../insomnia-scripting-environment/src/objects';
import packageJson from '../package.json';
import { exportSpecification, writeFileWithCliOptions } from './commands/export-specification';
import { getRuleSetFileFromFolderByFilename, lintSpecification } from './commands/lint-specification';
import type { Database } from './db';
import { isFile, loadDb } from './db';
import { insomniaExportAdapter } from './db/adapters/insomnia-adapter';
import { loadApiSpec, promptApiSpec } from './db/models/api-spec';
import { loadEnvironment, promptEnvironment } from './db/models/environment';
import type { BaseModel } from './db/models/types';
import { loadTestSuites, promptTestSuites } from './db/models/unit-test-suite';
import { matchIdIsh } from './db/models/util';
import { loadWorkspace, promptWorkspace } from './db/models/workspace';
import { logTestResult, logTestResultSummary, reporterTypes, type TestReporter } from './reporter';

export interface GlobalOptions {
  ci: boolean;
  config: string;
  printOptions: boolean;
  verbose: boolean;
  workingDir: string;
}

export const tryToReadInsoConfigFile = async (configFile?: string, workingDir?: string) => {
  try {
    const explorer = await cosmiconfig('inso');
    // set or detect .insorc in workingDir or cwd https://github.com/cosmiconfig/cosmiconfig?tab=readme-ov-file#explorersearch
    const results = configFile ? await explorer.load(configFile) : await explorer.search(workingDir || process.cwd());

    if (results && !results?.isEmpty) {
      logger.debug(`Found config file at ${results?.filepath}.`);
      const scripts = results.config?.scripts || {};
      const filePath = results.filepath;
      const options = ['workingDir', 'ci', 'verbose', 'printOptions'].reduce((acc, key) => {
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

export type LogsByType = Partial<Record<logType, string[]>>;

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
    case 'darwin': {
      return path.join(homedir(), 'Library', 'Application Support', app);
    }
    case 'win32': {
      return path.join(process.env.APPDATA || path.join(homedir(), 'AppData', 'Roaming'), app);
    }
    case 'linux': {
      return path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.config'), app);
    }
    default: {
      throw new Error('Unsupported platform');
    }
  }
}
export const getDefaultProductName = (): string => {
  const name = process.env.DEFAULT_APP_NAME;
  if (!name) {
    throw new Error('Environment variable DEFAULT_APP_NAME is not set.');
  }
  return name;
};

const localAppDir = getAppDataDir(getDefaultProductName());

export const getAbsoluteFilePath = ({ workingDir, file }: { workingDir?: string; file: string }) => {
  return file && path.resolve(workingDir || process.cwd(), file);
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
  console.log = () => {};
  try {
    return await callback();
  } finally {
    console.log = oldConsoleLog;
  }
};

const getWorkingDir = (options: { workingDir?: string }): string => {
  if (options.workingDir) {
    return path.resolve(options.workingDir);
  }

  logger.warn('No working directory provided, using local app data directory.');
  return localAppDir;
};

const resolveSpecInDatabase = async (identifier: string, options: GlobalOptions) => {
  const pathToSearch = getWorkingDir(options);

  const db = await loadDb({ pathToSearch, filterTypes: ['ApiSpec'] });
  if (!db.ApiSpec.length) {
    throw new InsoError(`Specification content not found using API spec id: "${identifier}" in "${pathToSearch}"`);
  }
  const specFromDb = identifier ? loadApiSpec(db, identifier) : await promptApiSpec(db, options.ci);
  if (!specFromDb?.contents) {
    throw new InsoError(`Specification content not found using API spec id: "${identifier}" in "${pathToSearch}"`);
  }
  return specFromDb.contents;
};
const getWorkspaceOrFallback = async (db: Database, identifier: string, ci: boolean) => {
  if (identifier) {
    return loadWorkspace(db, identifier);
  }
  if (ci && db.Workspace.length > 0) {
    return db.Workspace[0];
  }
  return await promptWorkspace(db, !!ci);
};
const getRequestsToRunFromListOrWorkspace = (db: Database, workspaceId: string, item: string[]): Request[] => {
  const getRequestGroupIdsRecursively = (from: string[]): string[] => {
    const parentIds = db.RequestGroup.filter(rg => from.includes(rg.parentId)).map(rg => rg._id);
    return [...parentIds, ...(parentIds.length > 0 ? getRequestGroupIdsRecursively(parentIds) : [])];
  };
  const hasItems = item.length > 0;
  if (hasItems) {
    const folderIds = item.filter(id => db.RequestGroup.find(rg => rg._id === id));
    const allRequestGroupIds = [...folderIds, ...getRequestGroupIdsRecursively(folderIds)];
    const folderRequests = db.Request.filter(req => allRequestGroupIds.includes(req.parentId)) as Request[];
    const reqItems = db.Request.filter(req => item.includes(req._id)) as Request[];

    return [...reqItems, ...folderRequests];
  }

  const allRequestGroupIds = getRequestGroupIdsRecursively([workspaceId]);
  return db.Request.filter(req => [workspaceId, ...allRequestGroupIds].includes(req.parentId)) as Request[];
};
// adds support for repeating args in commander.js eg. -i 1 -i 2 -i 3
const collect = (val: string, memo: string[]) => {
  memo.push(val);
  return memo;
};
const readFileFromPathOrUrl = async (pathOrUrl: string) => {
  if (!pathOrUrl) {
    return '';
  }
  if (pathOrUrl.startsWith('http')) {
    const response = await fetch(pathOrUrl);
    return response.text();
  }
  return readFile(pathOrUrl, 'utf8');
};
const pathToIterationData = async (pathOrUrl: string, env: string[]): Promise<UserUploadEnvironment[]> => {
  const envAsObject = env
    .map(envString => Object.fromEntries(new URLSearchParams(envString).entries()))
    .reduce((acc, obj) => ({ ...acc, ...obj }), {});
  const fileType = pathOrUrl.split('.').pop()?.toLowerCase();
  const content = await readFileFromPathOrUrl(pathOrUrl);
  if (!content) {
    return transformIterationDataToEnvironmentList([envAsObject]);
  }
  const list = getListFromFileOrUrl(content, fileType).map(data => ({ ...data, ...envAsObject }));
  return transformIterationDataToEnvironmentList(list);
};
const getListFromFileOrUrl = (content: string, fileType?: string): Record<string, string>[] => {
  if (fileType === 'json') {
    try {
      const jsonDataContent = JSON.parse(content);
      if (Array.isArray(jsonDataContent)) {
        return jsonDataContent.filter(
          data => data && typeof data === 'object' && !Array.isArray(data) && data !== null,
        );
      }
      throw new Error('Invalid JSON file uploaded, JSON file must be array of key-value pairs.');
    } catch (error) {
      throw new Error('Upload JSON file can not be parsed');
    }
  } else if (fileType === 'csv') {
    // Replace CRLF (Windows line break) and CR (Mac link break) with \n, then split into csv arrays
    const csvRows = content
      .replace(/\r\n|\r/g, '\n')
      .split('\n')
      .map(row => row.split(','));
    // at least 2 rows required for csv
    if (csvRows.length > 1) {
      const csvHeaders = csvRows[0];
      const csvContentRows = csvRows.slice(1);
      return csvContentRows.map(contentRow =>
        csvHeaders.reduce((acc: Record<string, any>, cur, idx) => {
          acc[cur] = contentRow[idx] ?? '';
          return acc;
        }, {}),
      );
    }
    throw new Error('CSV file must contain at least two rows with first row as variable names');
  }
  throw new Error(`Uploaded file is unsupported ${fileType}`);
};

const transformIterationDataToEnvironmentList = (list: Record<string, string>[]): UserUploadEnvironment[] => {
  return list?.map(data => {
    const orderedJson = orderedJSON.parse<Record<string, any>>(
      JSON.stringify(data || []),
      JSON_ORDER_PREFIX,
      JSON_ORDER_SEPARATOR,
    );
    return {
      name: 'User Upload',
      data: orderedJson.object,
      dataPropertyOrder: orderedJson.map || null,
    };
  });
};

export const go = (args?: string[]) => {
  const program = new commander.Command();
  const version = process.env.VERSION || packageJson.version;

  const proxySettings: {
    proxyEnabled: boolean;
    httpProxy: string;
    httpsProxy: string;
    noProxy: string;
  } = {
    proxyEnabled: false,
    httpProxy: '',
    httpsProxy: '',
    noProxy: '',
  };

  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy) {
    proxySettings.proxyEnabled = true;
    proxySettings.httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || '';
    proxySettings.httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || '';
    proxySettings.noProxy = process.env.NO_PROXY || process.env.no_proxy || '';
  }

  // Merge global options, config file options, and command options
  // Initialize logger
  const mergeOptionsAndInit = async <T extends Record<string, any>>(
    cmd: T,
  ): Promise<
    GlobalOptions &
      T & {
        configFileContent: Awaited<ReturnType<typeof tryToReadInsoConfigFile>>;
      }
  > => {
    const globals: GlobalOptions = program.optsWithGlobals();

    const commandOptions = { ...globals, ...cmd };
    const __configFile = await tryToReadInsoConfigFile(commandOptions.config, commandOptions.workingDir);

    const options = {
      ...(__configFile?.options || {}),
      ...commandOptions,
      configFileContent: __configFile,
    };
    logger.level = options.verbose ? LogLevel.Verbose : LogLevel.Info;
    options.ci && logger.setReporters([new BasicReporter()]);
    options.printOptions && logger.log('Loaded options', options, '\n');

    return options;
  };

  // export and lint logic
  // Provide a path to a file which looks like an insomnia db
  // it may contain multiple workspaces, and specs.
  // you can also just provide a spec file
  // things get confusing when you might have a workingDir and an identifier, since they can all be paths to a spec file

  // differences
  // lint can read a .spectral.yml from the folder provided
  // export can remove annotations and output to a file

  program
    .version(version, '-v, --version')
    .description(
      `A CLI for Insomnia!
  With this tool you can test, lint, and export your Insomnia data.
  Inso will try to detect your locally installed Insomnia data.
  You can also point it at a git repository folder, or an Insomnia export file.

  Examples:
  $ inso run collection
  $ inso run test
  $ inso lint spec
  $ inso export spec


  Inso also supports configuration files, by default it will look for .insorc in the current/provided working directory.
  $ inso export spec --config /some/path/.insorc
`,
    )
    .option('-w, --workingDir <dir>', 'set working directory/file: .insomnia folder, *.db.json, export.yaml', '')
    .option('--verbose', 'show additional logs while running the command', false)
    .option('--ci', 'run in CI, disables all prompts, defaults to false', false)
    .option('--config <path>', 'path to configuration file containing above options (.insorc)', '')
    .option('--printOptions', 'print the loaded options', false);

  const run = program.command('run').description('Execution utilities');

  const defaultReporter: TestReporter = 'spec';
  run
    .command('test [identifier]')
    .description('Run Insomnia unit test suites, identifier can be a test suite id or a API Spec id')
    .option('-e, --env <identifier>', 'environment to use', '')
    .option('-t, --testNamePattern <regex>', 'run tests that match the regex', '')
    .option('-r, --reporter <reporter>', `reporter to use, options are [${reporterTypes.join(', ')}]`, defaultReporter)
    .option('-b, --bail', 'abort ("bail") after first test failure', false)
    .option('--keepFile', 'do not delete the generated test file', false)
    .option('-k, --disableCertValidation', 'disable certificate validation for requests with SSL', false)
    .option('--httpsProxy <proxy>', 'URL for the proxy server for https requests.', proxySettings.httpsProxy)
    .option('--httpProxy <proxy>', 'URL for the proxy server for http requests.', proxySettings.httpProxy)
    .option(
      '--noProxy <comma_separated_list_of_hostnames>',
      'Comma separated list of hostnames that do not require a proxy to get reached, even if one is specified.',
      proxySettings.noProxy,
    )
    .action(
      async (
        identifier,
        cmd: {
          env: string;
          testNamePattern: string;
          reporter: TestReporter;
          bail: boolean;
          keepFile: boolean;
          disableCertValidation: boolean;
          ci: boolean;
          httpsProxy?: string;
          httpProxy?: string;
          noProxy?: string;
        },
      ) => {
        const options = await mergeOptionsAndInit(cmd);

        const pathToSearch = getWorkingDir(options);

        if (options.reporter && !reporterTypes.find(r => r === options.reporter)) {
          logger.fatal(`Reporter "${options.reporter}" not unrecognized. Options are [${reporterTypes.join(', ')}].`);
          return process.exit(1);
        }

        const db = await loadDb({
          pathToSearch,
          filterTypes: [],
        });

        // Find suites
        const suites = identifier ? loadTestSuites(db, identifier) : await promptTestSuites(db, !!options.ci);

        if (!suites.length) {
          logger.fatal('No test suites found; cannot run tests.', identifier);
          return process.exit(1);
        }

        // Find environment
        const workspaceId = suites[0].parentId;

        const environment = options.env
          ? loadEnvironment(db, workspaceId, options.env)
          : await promptEnvironment(db, !!options.ci, workspaceId);

        if (!environment) {
          logger.fatal('No environment identified; cannot run tests without a valid environment.');
          return process.exit(1);
        }

        const transientVariables = {
          ...init(),
          _id: uuidv4(),
          type: EnvironmentType,
          parentId: '',
          modified: 0,
          created: Date.now(),
          name: 'Transient Variables',
          data: {},
        };

        const proxyOptions: {
          proxyEnabled: boolean;
          httpProxy?: string;
          httpsProxy?: string;
          noProxy?: string;
        } = {
          proxyEnabled: Boolean(options.httpProxy || options.httpsProxy),
          httpProxy: options.httpProxy,
          httpsProxy: options.httpsProxy,
          noProxy: options.noProxy,
        };

        try {
          const sendRequest = await getSendRequestCallbackMemDb(environment._id, db, transientVariables, {
            validateSSL: !options.disableCertValidation,
            ...proxyOptions,
          });
          // Generate test file
          const testFileContents = generate(
            suites.map(suite => ({
              name: suite.name,
              suites: [],
              tests: db.UnitTest.filter(test => test.parentId === suite._id)
                .sort((a, b) => a.metaSortKey - b.metaSortKey)
                .map(({ name, code, requestId }) => ({ name, code, defaultRequestId: requestId })),
            })),
          );

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
      },
    );

  run
    .command('collection [identifier]')
    .description('Run Insomnia request collection, identifier can be a workspace id')
    .option('-t, --requestNamePattern <regex>', 'run requests that match the regex', '')
    .option('-i, --item <requestid>', 'request or folder id to run', collect, [])
    .option('-e, --env <identifier>', 'environment to use', '')
    .option('-g, --globals <identifier>', 'global environment to use (filepath or id)', '')
    .option('--delay-request <duration>', 'milliseconds to delay between requests', '0')
    .option('--env-var <key=value>', 'override environment variables', collect, [])
    .option('-n, --iteration-count <count>', 'number of times to repeat', '1')
    .option('-d, --iteration-data <path/url>', 'file path or url (JSON or CSV)', '')
    .option('-r, --reporter <reporter>', `reporter to use, options are [${reporterTypes.join(', ')}]`, defaultReporter)
    .option('-b, --bail', 'abort ("bail") after first non-200 response', false)
    .option('--disableCertValidation', 'disable certificate validation for requests with SSL', false)
    .option('--httpsProxy <proxy>', 'URL for the proxy server for https requests.', proxySettings.httpsProxy)
    .option('--httpProxy <proxy>', 'URL for the proxy server for http requests.', proxySettings.httpProxy)
    .option(
      '--noProxy <comma_separated_list_of_hostnames>',
      'Comma separated list of hostnames that do not require a proxy to get reached, even if one is specified.',
      proxySettings.noProxy,
    )
    .action(
      async (
        identifier,
        cmd: {
          env: string;
          globals: string;
          disableCertValidation: boolean;
          requestNamePattern: string;
          bail: boolean;
          item: string[];
          delayRequest: string;
          iterationCount: string;
          iterationData: string;
          envVar: string[];
          httpsProxy?: string;
          httpProxy?: string;
          noProxy?: string;
          reporter: TestReporter;
        },
      ) => {
        const options = await mergeOptionsAndInit(cmd);

        // const commandOptions = { ...globals, ...cmd };
        // const __configFile = await tryToReadInsoConfigFile(commandOptions.config, commandOptions.workingDir);
        const currentDir = __dirname;
        console.log(`Current directory: ${currentDir}`);
        const insomniaDir = path.join('/snapshot', 'insomnia', 'packages', 'insomnia');
        const insoDir = path.join('/snapshot', 'insomnia', 'packages', 'insomnia-inso');
        const getAllFiles = async (dir: string) => {
          console.log(`📂 Scanning directory: ${dir}`);
          const entries = await fs.readdirSync(dir, { withFileTypes: true });

          const files: string[][] = await Promise.all(
            entries.map(async entry => {
              const fullPath = path.join(dir, entry.name);

              if (entry.isDirectory()) {
                console.log(`📁 Entering subdirectory: ${fullPath}`);
                return await getAllFiles(fullPath); // recursive call
              }
              console.log(`📄 Found file: ${fullPath}`);
              return fullPath;
            }),
          );

          return files.flat();
        };

        // list all directories in the insomnia directory
        if (fs.existsSync(insomniaDir)) {
          console.log(`insomniaDir: ${insomniaDir}`);
          const directories = fs.readdirSync(insomniaDir, { withFileTypes: true });
          console.log(
            'Directories in Insomnia directory:',
            directories.map(dirent => dirent.name),
          );
          getAllFiles(insomniaDir);
          // const insomniaPluginDir = path.join(insomniaDir, 'plugins', 'insomnia-plugin-external-vault');
          // if (fs.existsSync(insomniaPluginDir)) {
          //   console.log(`insomnia plugin dir ${insomniaPluginDir}`);
          //   const pluginDirectories = fs.readdirSync(insomniaPluginDir, { withFileTypes: true });
          //   console.log(
          //     'Directories in Insomnia plugins directory:',
          //     pluginDirectories.map(dirent => dirent.name),
          //   );
          // }
        }
        const insoDirectories = fs.readdirSync(insoDir, { withFileTypes: true });
        console.log(
          `Inso directories:`,
          insoDirectories.map(dirent => dirent.name),
        );
        return;
      },
    );

  program
    .command('lint')
    .description(
      'Lint a yaml file in the workingDir or the provided file path (with  .spectral.yml) or a spec in an Insomnia database directory',
    )
    .command('spec [identifier]')
    .description('Lint an API Specification, identifier can be an API Spec id or a file path')
    .action(async identifier => {
      const options = await mergeOptionsAndInit({});

      // Assert identifier is a file
      const identifierAsAbsPath =
        identifier && getAbsoluteFilePath({ workingDir: options.workingDir, file: identifier });
      let isIdentifierAFile = false;
      try {
        isIdentifierAFile = identifier && (await fs.promises.stat(identifierAsAbsPath)).isFile();
      } catch (err) {}
      const pathToSearch = '';
      let specContent;
      let rulesetFileName;
      if (isIdentifierAFile) {
        // try load as a file
        logger.trace(`Linting specification file from identifier: \`${identifierAsAbsPath}\``);
        specContent = await fs.promises.readFile(identifierAsAbsPath, 'utf-8');
        rulesetFileName = await getRuleSetFileFromFolderByFilename(identifierAsAbsPath);
        if (!specContent) {
          logger.fatal(`Specification content not found using path: ${identifier} in ${identifierAsAbsPath}`);
          return process.exit(1);
        }
      }
      if (!isIdentifierAFile) {
        try {
          specContent = await resolveSpecInDatabase(identifier, options);
        } catch (err) {
          logErrorAndExit(err);
        }
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

  program
    .command('export')
    .description('Export data from insomnia models')
    .command('spec [identifier]')
    .description('Export an API Specification to a file, identifier can be an API Spec id')
    .option('-o, --output <path>', 'save the generated config to a file', '')
    .option('-s, --skipAnnotations', 'remove all "x-kong-" annotations, defaults to false', false)
    .action(async (identifier, cmd: { output: string; skipAnnotations: boolean }) => {
      const options = await mergeOptionsAndInit(cmd);

      let specContent = '';
      try {
        specContent = await resolveSpecInDatabase(identifier, options);
      } catch (err) {
        logErrorAndExit(err);
      }
      try {
        const toExport = await exportSpecification({
          specContent,
          skipAnnotations: options.skipAnnotations,
        });
        const outputPath =
          options.output && getAbsoluteFilePath({ workingDir: options.workingDir, file: options.output });
        if (!outputPath) {
          logger.log(toExport);
          return process.exit(0);
        }
        const filePath = await writeFileWithCliOptions(outputPath, toExport);
        logger.log(`Specification exported to "${filePath}".`);
        return process.exit(0);
      } catch (error) {
        logErrorAndExit(error);
      }
      return process.exit(1);
    });

  // Add script base command
  program
    .command('script <script-name>')
    .description('Run scripts defined in .insorc')
    .allowUnknownOption()
    .action(async (scriptName: string, cmd) => {
      const options = await mergeOptionsAndInit(cmd);

      const scriptTask = options.configFileContent?.scripts?.[scriptName];

      if (!scriptTask) {
        logger.fatal(
          `Could not find inso script "${scriptName}" in the config file.`,
          Object.keys(options.configFileContent?.scripts || {}),
        );
        return process.exit(1);
      }

      if (!scriptTask.startsWith('inso')) {
        logger.fatal('Tasks in a script should start with `inso`.');
        return process.exit(1);
      }

      // Get args after script name
      const passThroughArgs = program.args.slice(program.args.indexOf(scriptName) + 1);
      const scriptArgs: string[] = parseArgsStringToArgv(`self ${scriptTask} ${passThroughArgs.join(' ')}`);

      logger.debug(`>> ${scriptArgs.slice(1).join(' ')}`);

      program.parseAsync(scriptArgs).catch(logErrorAndExit);
    });

  program.parseAsync(args || process.argv).catch(logErrorAndExit);
};

const getNextRequestOffset = (leftRequestsToRun: Request[], nextRequestIdOrName: string) => {
  const idMatchOffset = leftRequestsToRun.findIndex(req => req._id.trim() === nextRequestIdOrName.trim());
  if (idMatchOffset >= 0) {
    return idMatchOffset;
  }

  const nameMatchOffset = leftRequestsToRun.reverse().findIndex(req => req.name.trim() === nextRequestIdOrName.trim());
  if (nameMatchOffset >= 0) {
    return leftRequestsToRun.length - 1 - nameMatchOffset;
  }

  return leftRequestsToRun.length;
};
