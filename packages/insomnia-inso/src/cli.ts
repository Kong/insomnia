import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import * as commander from 'commander';
import consola, { BasicReporter, FancyReporter, LogLevel, logType } from 'consola';
import { cosmiconfig } from 'cosmiconfig';
import fs from 'fs';
import { JSON_ORDER_PREFIX, JSON_ORDER_SEPARATOR } from 'insomnia/src/common/constants';
import { getSendRequestCallbackMemDb } from 'insomnia/src/common/send-request';
import { init, type as EnvironmentType, UserUploadEnvironment } from 'insomnia/src/models/environment';
import { Request } from 'insomnia/src/models/request';
import { RequestGroup } from 'insomnia/src/models/request-group';
import { deserializeNDJSON } from 'insomnia/src/utils/ndjson';
import { type RequestTestResult } from 'insomnia-sdk';
import { generate, runTestsCli } from 'insomnia-testing';
import orderedJSON from 'json-order';
import { parseArgsStringToArgv } from 'string-argv';
import { v4 as uuidv4 } from 'uuid';

import packageJson from '../package.json';
import { exportSpecification, writeFileWithCliOptions } from './commands/export-specification';
import { getRuleSetFileFromFolderByFilename, lintSpecification } from './commands/lint-specification';
import { Database, isFile, loadDb } from './db';
import { insomniaExportAdapter } from './db/adapters/insomnia-adapter';
import { loadApiSpec, promptApiSpec } from './db/models/api-spec';
import { loadEnvironment, promptEnvironment } from './db/models/environment';
import { BaseModel } from './db/models/types';
import { loadTestSuites, promptTestSuites } from './db/models/unit-test-suite';
import { matchIdIsh } from './db/models/util';
import { loadWorkspace, promptWorkspace } from './db/models/workspace';

export interface GlobalOptions {
  ci: boolean;
  config: string;
  exportFile: string;
  printOptions: boolean;
  verbose: boolean;
  workingDir: string;
};

export type TestReporter = 'dot' | 'list' | 'spec' | 'min' | 'progress' | 'tap';
export const reporterTypes: TestReporter[] = ['dot', 'list', 'min', 'progress', 'spec', 'tap'];

export const tryToReadInsoConfigFile = async (configFile?: string, workingDir?: string) => {
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
  console.log = () => { };
  try {
    return await callback();
  } finally {
    console.log = oldConsoleLog;
  }
};

const resolveSpecInDatabase = async (identifier: string, options: GlobalOptions) => {
  let pathToSearch = '';
  const useLocalAppData = !options.workingDir && !options.exportFile;
  if (useLocalAppData) {
    logger.warn('No working directory or export file provided, using local app data directory.');
    pathToSearch = localAppDir;
  } else {
    pathToSearch = path.resolve(options.workingDir || process.cwd(), options.exportFile || '');
  }
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
const localAppDir = getAppDataDir(getDefaultProductName());
const logTestResult = (reporter: TestReporter, testResults?: RequestTestResult[]) => {
  if (!testResults || testResults.length === 0) {
    return '';
  }
  const fallbackReporter = testResults.map(r => `${r.status === 'passed' ? '✅' : '❌'} ${r.testCase}`).join('\n');

  const reporterMap = {
    dot: testResults.map(r => r.status === 'passed' ? '.' : 'F').join(''),
    list: fallbackReporter,
    min: ' ',
    progress: `[${testResults.map(r => r.status === 'passed' ? '-' : 'x').join('')}]`,
    spec: fallbackReporter,
    tap: convertToTAP(testResults),
  };
  const summary = `

Total tests: ${testResults.length}
Passed: ${testResults.filter(r => r.status === 'passed').length}
Failed: ${testResults.filter(r => r.status === 'failed').length}

${testResults.filter(r => r.status === 'failed').map(r => r.errorMessage).join('\n')}`;
  return `${reporterMap[reporter] || fallbackReporter}${summary}`;
};
function convertToTAP(testCases: RequestTestResult[]): string {
  let tapOutput = 'TAP version 13\n';
  const totalTests = testCases.length;
  // Add the number of test cases
  tapOutput += `1..${totalTests}\n`;
  // Iterate through each test case and format it in TAP
  testCases.forEach((test, index) => {
    const testNumber = index + 1;
    const testStatus = test.status === 'passed' ? 'ok' : 'not ok';
    tapOutput += `${testStatus} ${testNumber} - ${test.testCase}\n`;
  });
  return tapOutput;
}
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
  const envAsObject = env.map(envString => Object.fromEntries(new URLSearchParams(envString).entries())).reduce((acc, obj) => ({ ...acc, ...obj }), {});
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
        return jsonDataContent.filter(data => data && typeof data === 'object' && !Array.isArray(data) && data !== null);
      }
      throw new Error('Invalid JSON file uploaded, JSON file must be array of key-value pairs.');
    } catch (error) {
      throw new Error('Upload JSON file can not be parsed');
    }
  } else if (fileType === 'csv') {
    // Replace CRLF (Windows line break) and CR (Mac link break) with \n, then split into csv arrays
    const csvRows = content.replace(/\r\n|\r/g, '\n').split('\n').map(row => row.split(','));
    // at least 2 rows required for csv
    if (csvRows.length > 1) {
      const csvHeaders = csvRows[0];
      const csvContentRows = csvRows.slice(1, csvRows.length);
      return csvContentRows.map(contentRow => csvHeaders.reduce((acc: Record<string, any>, cur, idx) => {
        acc[cur] = contentRow[idx] ?? '';
        return acc;
      }, {}));
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

  if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
    proxySettings.proxyEnabled = true;
    proxySettings.httpProxy = process.env.HTTP_PROXY || '';
    proxySettings.httpsProxy = process.env.HTTPS_PROXY || '';
    proxySettings.noProxy = process.env.NO_PROXY || '';
  }

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
  $ inso run collection
  $ inso run test
  $ inso lint spec
  $ inso export spec


  Inso also supports configuration files, by default it will look for .insorc in the current/provided working directory.
  $ inso export spec --config /some/path/.insorc
`)
    .option('-w, --workingDir <dir>', 'set working directory/file: .insomnia folder, *.db.json, export.yaml', '')
    .option('--verbose', 'show additional logs while running the command', false)
    .option('--ci', 'run in CI, disables all prompts, defaults to false', false)
    .option('--config <path>', 'path to configuration file containing above options (.insorc)', '')
    .option('--printOptions', 'print the loaded options', false);

  const run = program.command('run')
    .description('Execution utilities');

  const defaultReporter: TestReporter = 'spec';
  run.command('test [identifier]')
    .description('Run Insomnia unit test suites, identifier can be a test suite id or a API Spec id')
    .option('-e, --env <identifier>', 'environment to use', '')
    .option('-t, --testNamePattern <regex>', 'run tests that match the regex', '')
    .option('-r, --reporter <reporter>', `reporter to use, options are [${reporterTypes.join(', ')}]`, defaultReporter)
    .option('-b, --bail', 'abort ("bail") after first test failure', false)
    .option('--keepFile', 'do not delete the generated test file', false)
    .option('-k, --disableCertValidation', 'disable certificate validation for requests with SSL', false)
    .option('--httpsProxy <proxy>', 'proxy server for https requests', proxySettings.httpsProxy)
    .option('--httpProxy <proxy>', 'proxy server for http requests', proxySettings.httpProxy)
    .option('--noProxy <proxy>', 'proxy server for no proxy requests', proxySettings.noProxy)
    .action(async (identifier, cmd: { env: string; testNamePattern: string; reporter: TestReporter; bail: boolean; keepFile: boolean; disableCertValidation: boolean; ci: boolean; httpsProxy?: string; httpProxy?: string; noProxy?: string }) => {
      const globals: GlobalOptions = program.optsWithGlobals();
      const commandOptions = { ...globals, ...cmd };
      const __configFile = await tryToReadInsoConfigFile(commandOptions.config, commandOptions.workingDir);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
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

      const environment = options.env ? loadEnvironment(db, workspaceId, options.env) : await promptEnvironment(db, !!options.ci, workspaceId);

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
        const sendRequest = await getSendRequestCallbackMemDb(environment._id, db, transientVariables, { validateSSL: !options.disableCertValidation, ...proxyOptions });
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
    .option('--httpsProxy <proxy>', 'proxy server for https requests', proxySettings.httpsProxy)
    .option('--httpProxy <proxy>', 'proxy server for http requests', proxySettings.httpProxy)
    .option('--noProxy <proxy>', 'proxy server for no proxy requests', proxySettings.noProxy)
    .action(async (identifier, cmd: { env: string; globals: string; disableCertValidation: boolean; requestNamePattern: string; bail: boolean; item: string[]; delayRequest: string; iterationCount: string; iterationData: string; envVar: string[]; httpsProxy?: string; httpProxy?: string; noProxy?: string }) => {
      const globals: { config: string; workingDir: string; exportFile: string; ci: boolean; printOptions: boolean; verbose: boolean } = program.optsWithGlobals();

      const commandOptions = { ...globals, ...cmd };
      const __configFile = await tryToReadInsoConfigFile(commandOptions.config, commandOptions.workingDir);

      const options = {
        reporter: defaultReporter,
        ...__configFile?.options || {},
        ...commandOptions,
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

      const db = await loadDb({
        pathToSearch,
        filterTypes: [],
      });

      const workspace = await getWorkspaceOrFallback(db, identifier, options.ci);
      if (!workspace) {
        logger.fatal('No workspace found in the provided data store or fallbacks.');
        return process.exit(1);
      }

      // Find environment
      const workspaceId = workspace._id;
      // get global env by id from nedb or gitstore, or first element from file
      // smell: mutates db
      if (options.globals) {
        const isGlobalFile = await isFile(options.globals);
        if (!isGlobalFile) {
          const globalEnv = db.Environment.find(env => matchIdIsh(env, options.globals) || env.name === options.globals);
          if (!globalEnv) {
            logger.warn('No global environment found with id or name', options.globals);
            return process.exit(1);
          }
          if (globalEnv) {
            // attach this global env to the workspace
            db.WorkspaceMeta = [{ activeGlobalEnvironmentId: globalEnv._id, _id: `wrkm_${uuidv4().replace(/-/g, '')}`, type: 'WorkspaceMeta', parentId: workspaceId, name: '' }];
          }
        }
        if (isGlobalFile) {
          const globalEnvDb = await insomniaExportAdapter(options.globals, ['Environment']);
          logger.trace('--globals is a file path, loading from file, global env selection is not currently supported, taking first element');
          const firstGlobalEnv = globalEnvDb?.Environment?.[0];
          if (!firstGlobalEnv) {
            logger.warn('No environments found in the file', options.globals);
            return process.exit(1);
          }
          // mutate db to include the global envs
          db.Environment = [...db.Environment, ...globalEnvDb.Environment];
          // attach this global env to the workspace
          db.WorkspaceMeta = [{ activeGlobalEnvironmentId: firstGlobalEnv._id, _id: `wrkm_${uuidv4().replace(/-/g, '')}`, type: 'WorkspaceMeta', parentId: workspaceId, name: '' }];
        }
      }
      const environment = options.env ? loadEnvironment(db, workspaceId, options.env) : await promptEnvironment(db, !!options.ci, workspaceId);
      if (!environment) {
        logger.fatal('No environment identified; cannot run requests without a valid environment.');
        return process.exit(1);
      }

      let requestsToRun = getRequestsToRunFromListOrWorkspace(db, workspaceId, options.item);
      if (options.requestNamePattern) {
        requestsToRun = requestsToRun.filter(req => req.name.match(new RegExp(options.requestNamePattern)));
      }
      if (!requestsToRun.length) {
        logger.fatal('No requests identified; nothing to run.');
        return process.exit(1);
      }

      // sort requests
      const isRunningFolder = options.item.length === 1 && options.item[0].startsWith('fld_');
      if (options.item.length && !isRunningFolder) {
        const requestOrder = new Map<string, number>();
        options.item.forEach((reqId: string, order: number) => requestOrder.set(reqId, order + 1));
        requestsToRun = requestsToRun.sort((a, b) => (requestOrder.get(a._id) || requestsToRun.length) - (requestOrder.get(b._id) || requestsToRun.length));
      } else {
        const getAllParentGroupSortKeys = (doc: BaseModel): number[] => {
          const parentFolder = db.RequestGroup.find(rg => rg._id === doc.parentId);
          if (parentFolder === undefined) {
            return [];
          }
          return [(parentFolder as RequestGroup).metaSortKey, ...getAllParentGroupSortKeys(parentFolder)];
        };

        // sort by metaSortKey (manual sorting order)
        requestsToRun = requestsToRun.map(request => {
          const allParentGroupSortKeys = getAllParentGroupSortKeys(request as BaseModel);

          return {
            ancestors: allParentGroupSortKeys.reverse(),
            request,
          };
        }).sort((a, b) => {
          let compareResult = 0;

          let i = 0, j = 0;
          for (; i < a.ancestors.length && j < b.ancestors.length; i++, j++) {
            const aSortKey = a.ancestors[i];
            const bSortKey = b.ancestors[j];
            if (aSortKey < bSortKey) {
              compareResult = -1;
              break;
            } else if (aSortKey > bSortKey) {
              compareResult = 1;
              break;
            }
          }
          if (compareResult !== 0) {
            return compareResult;
          }

          if (a.ancestors.length === b.ancestors.length) {
            return a.request.metaSortKey - b.request.metaSortKey;
          }

          if (i < a.ancestors.length) {
            return a.ancestors[i] - b.request.metaSortKey;
          } else if (j < b.ancestors.length) {
            return a.request.metaSortKey - b.ancestors[j];
          }
          return 0;
        }).map(({ request }) => request);
      }

      try {
        const iterationCount = parseInt(options.iterationCount, 10);

        const iterationData = await pathToIterationData(options.iterationData, options.envVar);
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

        const sendRequest = await getSendRequestCallbackMemDb(environment._id, db, transientVariables, { validateSSL: !options.disableCertValidation, ...proxyOptions }, iterationData, iterationCount);
        let success = true;
        for (let i = 0; i < iterationCount; i++) {
          let reqIndex = 0;
          while (reqIndex < requestsToRun.length) {
            const req = requestsToRun[reqIndex];

            if (options.bail && !success) {
              return;
            }
            logger.log(`Running request: ${req.name} ${req._id}`);
            const res = await sendRequest(req._id, i);
            if (!res) {
              logger.error('Timed out while running script');
              success = false;
              continue;
            }

            const timelineString = await readFile(res.timelinePath, 'utf8');
            const appendNewLineIfNeeded = (str: string) => str.endsWith('\n') ? str : str + '\n';
            const timeline = deserializeNDJSON(timelineString).map(e => appendNewLineIfNeeded(e.value)).join('');
            logger.trace(timeline);
            if (res.testResults?.length) {
              console.log(`
Test results:`);
              console.log(logTestResult(options.reporter, res.testResults));
              const hasFailedTests = res.testResults.some(t => t.status === 'failed');
              if (hasFailedTests) {
                success = false;
              }
            }

            await new Promise(r => setTimeout(r, parseInt(options.delayRequest, 10)));

            if (res.nextRequestIdOrName) {
              const offset = getNextRequestOffset(requestsToRun.slice(reqIndex), res.nextRequestIdOrName);
              reqIndex += offset;
              if (reqIndex < requestsToRun.length) {
                console.log(`The next request has been pointed to "${requestsToRun[reqIndex].name}"`);
              } else {
                console.log(`No request has been found for "${res.nextRequestIdOrName}", ending the iteration`);
              }
            } else {
              reqIndex++;
            }
          }
        }
        return process.exit(success ? 0 : 1);
      } catch (error) {
        logErrorAndExit(error);
      }
      return process.exit(1);
    });

  program.command('lint')
    .description('Lint a yaml file in the workingDir or the provided file path (with  .spectral.yml) or a spec in an Insomnia database directory')
    .command('spec [identifier]')
    .description('Lint an API Specification, identifier can be an API Spec id or a file path')
    .action(async identifier => {
      const globals: GlobalOptions = program.optsWithGlobals();
      const commandOptions = globals;
      const __configFile = await tryToReadInsoConfigFile(commandOptions.config, commandOptions.workingDir);
      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
      };
      logger.level = options.verbose ? LogLevel.Verbose : LogLevel.Info;
      options.ci && logger.setReporters([new BasicReporter()]);
      // Assert identifier is a file
      const identifierAsAbsPath = identifier && getAbsoluteFilePath({ workingDir: options.workingDir, file: identifier });
      let isIdentiferAFile = false;
      try {
        isIdentiferAFile = identifier && (await fs.promises.stat(identifierAsAbsPath)).isFile();
      } catch (err) { }
      const pathToSearch = '';
      let specContent;
      let rulesetFileName;
      if (isIdentiferAFile) {
        // try load as a file
        logger.trace(`Linting specification file from identifier: \`${identifierAsAbsPath}\``);
        specContent = await fs.promises.readFile(identifierAsAbsPath, 'utf-8');
        rulesetFileName = await getRuleSetFileFromFolderByFilename(identifierAsAbsPath);
        if (!specContent) {
          logger.fatal(`Specification content not found using path: ${identifier} in ${identifierAsAbsPath}`);
          return process.exit(1);
        }
      }
      if (!isIdentiferAFile) {
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

  program.command('export').description('Export data from insomnia models')
    .command('spec [identifier]')
    .description('Export an API Specification to a file, identifier can be an API Spec id')
    .option('-o, --output <path>', 'save the generated config to a file', '')
    .option('-s, --skipAnnotations', 'remove all "x-kong-" annotations, defaults to false', false)
    .action(async (identifier, cmd: { output: string; skipAnnotations: boolean }) => {
      const globals: GlobalOptions = program.optsWithGlobals();
      const commandOptions = { ...globals, ...cmd };
      const __configFile = await tryToReadInsoConfigFile(commandOptions.config, commandOptions.workingDir);
      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
      };
      options.printOptions && logger.log('Loaded options', options, '\n');
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
        const outputPath = options.output && getAbsoluteFilePath({ workingDir: options.workingDir, file: options.output });
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
  program.command('script <script-name>')
    .description('Run scripts defined in .insorc')
    .allowUnknownOption()
    .action(async (scriptName: string, cmd) => {
      const commandOptions = { ...program.optsWithGlobals(), ...cmd };
      // TODO: getAbsolutePath to working directory and use it to check from config file
      const __configFile = await tryToReadInsoConfigFile(commandOptions.config, commandOptions.workingDir);

      const options = {
        ...__configFile?.options || {},
        ...commandOptions,
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

const getNextRequestOffset = (
  leftRequestsToRun: Request[],
  nextRequestIdOrName: string
) => {
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
