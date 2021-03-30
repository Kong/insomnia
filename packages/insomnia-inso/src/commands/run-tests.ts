// @flow
import { generate, runTestsCli } from 'insomnia-testing';
import type { GlobalOptions } from '../get-options';
import { loadDb } from '../db';
import type { UnitTest, UnitTestSuite } from '../db/models/types';
import logger, { noConsoleLog } from '../logger';
import { loadTestSuites, promptTestSuites } from '../db/models/unit-test-suite';
import { loadEnvironment, promptEnvironment } from '../db/models/environment';

export const TestReporterEnum = {
  dot: 'dot',
  doc: 'doc',
  tap: 'tap',
  json: 'json',
  list: 'list',
  min: 'min',
  spec: 'spec',
  nyan: 'nyan',
  xunit: 'xunit',
  markdown: 'markdown',
  progress: 'progress',
  landing: 'landing',
  'json-stream': 'json-stream',
};

export type RunTestsOptions = GlobalOptions & {
  env?: string,
  reporter: string,
  reporterOptions?: Array<string>,
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

function isExternalReporter({ reporter }: RunTestsOptions): boolean {
  return reporter && !TestReporterEnum[reporter];
}

function getTestSuite(dbSuite: UnitTestSuite, dbTests: Array<UnitTest>) {
  return {
    name: dbSuite.name,
    tests: dbTests.map(({ name, code, requestId }) => ({
      name,
      code,
      defaultRequestId: requestId,
    })),
  };
}

async function getEnvironments(db, ci, suites, env) {
  const workspaceId = suites[0].parentId;
  return env
    ? loadEnvironment(db, workspaceId, env)
    : await promptEnvironment(db, !!ci, workspaceId);
}

async function getTestFileContent(db, suites) {
  return await generate(
    suites.map(suite =>
      getTestSuite(
        suite,
        db.UnitTest.filter(t => t.parentId === suite._id),
      ),
    ),
  );
}

/**
 * Extract an object from string given a key=value format
 * @param data An array of 'equal'(=) separated key value pairs
 */
function getReporterOptions(data: Array<string> = []): Object {
  const obj = {};
  data.forEach(arg => {
    const [key, value] = arg.split('=', 2);
    obj[key] = value;
  });
  return obj;
}

// Identifier can be the id or name of a workspace, apiSpec, or unit test suite
export async function runInsomniaTests(
  identifier?: string,
  options: RunTestsOptions,
): Promise<boolean> {
  const { reporter, reporterOptions, ci, bail, keepFile, testNamePattern, env } = options;
  // Loading database instance
  const db = await loadDb(options);

  // Check if any provider has been provided (Yeah, comedy king)
  const isExternal = isExternalReporter(options);
  // Extracting data key=value as an object
  const reporterOptionsObj = getReporterOptions(reporterOptions);

  // Find suites
  const suites = identifier ? loadTestSuites(db, identifier) : await promptTestSuites(db, !!ci);

  if (!suites.length) {
    logger.fatal('No test suites found; cannot run tests.');
    return false;
  }

  // Find env
  const environment = await getEnvironments(db, ci, suites, env);

  if (!environment) {
    logger.fatal('No environment identified; cannot run tests without a valid environment.');
    return false;
  }

  // Generate test file
  const testFiles = await getTestFileContent(db, suites);

  // Load lazily when needed, otherwise this require slows down the entire CLI.
  const { getSendRequestCallbackMemDb } = require('insomnia-send-request');
  const sendRequest = await getSendRequestCallbackMemDb(environment._id, db);

  const config = {
    reporter,
    reporterOptions: reporterOptionsObj,
    bail,
    keepFile,
    sendRequest,
    testFilter: testNamePattern,
  };

  if (isExternal) {
    try {
      await runTestsCli(testFiles, config);
    } catch (e) {
      isReporterFailure(reporter, e.toString());
    }
  } else {
    await noConsoleLog(() => runTestsCli(testFiles, config));
  }
}
