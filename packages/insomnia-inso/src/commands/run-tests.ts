import { generate, runTestsCli } from 'insomnia-testing';
import type { GlobalOptions } from '../get-options';
import { Database, loadDb } from '../db';
import type { UnitTest, UnitTestSuite } from '../db/models/types';
import { logger, noConsoleLog } from '../logger';
import { loadTestSuites, promptTestSuites } from '../db/models/unit-test-suite';
import { loadEnvironment, promptEnvironment } from '../db/models/environment';
import { parseObjFromKeyValuePair } from '../util';

export type TestReporter =
  'dot'
  | 'doc'
  | 'tap'
  | 'json'
  | 'list'
  | 'min'
  | 'spec'
  | 'nyan'
  | 'xunit'
  | 'markdown'
  | 'progress'
  | 'landing'
  | 'json-stream'
  | string;

export const reporterTypes: TestReporter[] = [
  'dot',
  'doc',
  'tap',
  'json',
  'list',
  'min',
  'spec',
  'nyan',
  'xunit',
  'markdown',
  'progress',
  'landing',
  'json-stream',
];

export const reporterTypesSet = new Set(reporterTypes);

export type RunTestsOptions = GlobalOptions & {
  env?: string,
  reporter: typeof reporterTypes[number] | string,
  reporterOptions?: string[],
  bail?: boolean,
  keepFile?: boolean,
  testNamePattern?: string,
};

export function isReporterFailure(reporter: string, err: string): void {
  if (err.includes('invalid reporter')) {
    logger.fatal(`Reporter "${reporter}" not found: ${err}`);
  } else {
    logger.fatal(err);
  }
}

function isExternalReporter(reporter = ''): boolean {
  return !reporterTypesSet.has(reporter);
}

function getTestSuite(dbSuite: UnitTestSuite, dbTests: UnitTest[]) {
  return {
    name: dbSuite.name,
    suites: [],
    tests: dbTests.map(({ name, code, requestId }) => ({
      name,
      code,
      defaultRequestId: requestId,
    })),
  };
}

async function getEnvironments(db: Database, suites: UnitTestSuite[], ci: boolean, env?: string) {
  const workspaceId = suites[0].parentId;
  return env
    ? loadEnvironment(db, workspaceId, env)
    : await promptEnvironment(db, ci, workspaceId);
}

async function getTestFileContent(db: Database, suites: UnitTestSuite[]) {
  return generate(
    suites.map((suite: UnitTestSuite) => getTestSuite(
      suite,
      db.UnitTest.filter((t: UnitTest) => t.parentId === suite._id),
    ),
    ),
  );
}

// Identifier can be the id or name of a workspace, apiSpec, or unit test suite
export async function runInsomniaTests(
  identifier: string | null | undefined,
  options: Partial<RunTestsOptions>,
): Promise<boolean> {
  const { reporter, reporterOptions, ci = false, bail, keepFile, testNamePattern, env } = options;
  // Loading database instance
  const db = await loadDb(options);

  // Check if any provider has been provided (Yeah, comedy king)
  const isExternal = isExternalReporter(reporter);
  // Extracting data key=value as an object
  const reporterOptionsObj = parseObjFromKeyValuePair(reporterOptions);

  // Find suites
  const suites = identifier ? loadTestSuites(db, identifier) : await promptTestSuites(db, ci);

  if (!suites.length) {
    logger.fatal('No test suites found; cannot run tests.');
    return false;
  }

  // Find env
  const environment = await getEnvironments(db, suites, ci, env);

  if (!environment) {
    logger.fatal('No environment identified; cannot run tests without a valid environment.');
    return false;
  }

  // Generate test file
  const testFiles = await getTestFileContent(db, suites);

  // eslint-disable-next-line @typescript-eslint/no-var-requires -- Load lazily when needed, otherwise this require slows down the entire CLI.
  const { getSendRequestCallbackMemDb } = require('insomnia-send-request');
  const sendRequest = await getSendRequestCallbackMemDb(environment._id, db);

  const config = {
    /*
    * Q: Why type assertion as never?
    * A: The problem comes from runTestsCli using the internal mocha.js interface representation called <ReporterContributions>.
    * Due to being stated that this module should be independent from insomnia-testing implementation
    * the only way I can remove the type-assertion error is forcing it as never
    * */
    reporter: reporter as never,
    reporterOptions: reporterOptionsObj,
    bail,
    keepFile,
    sendRequest,
    testFilter: testNamePattern,
  };

  let result = false;

  if (isExternal) {
    try {
      result = await runTestsCli(testFiles, config);
    } catch (e) {
      /* Due to 'option' var expressed as Partial, even if 'reporter' it's not optional, I must use a type assertion here
      /* I prefer to do not initialize it with anything else but using an assertion because it may be misleading when bug-reporting */
      isReporterFailure(reporter as string, e.toString());
    }
  } else {
    result = await noConsoleLog(() => runTestsCli(testFiles, config));
  }

  return result;
}
