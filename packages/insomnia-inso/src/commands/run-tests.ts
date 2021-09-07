import { generate, runTestsCli, TestSuite } from 'insomnia-testing';

import { loadDb } from '../db';
import { loadEnvironment, promptEnvironment } from '../db/models/environment';
import type { UnitTest, UnitTestSuite } from '../db/models/types';
import { loadTestSuites, promptTestSuites } from '../db/models/unit-test-suite';
import type { GlobalOptions } from '../get-options';
import { logger, noConsoleLog } from '../logger';

export type TestReporter = 'dot' | 'list' | 'spec' | 'min' | 'progress';

export const reporterTypes: TestReporter[] = [
  'dot',
  'list',
  'min',
  'progress',
  'spec',
];

export const reporterTypesSet = new Set(reporterTypes);

export type RunTestsOptions = GlobalOptions & {
  env?: string;
  reporter: TestReporter;
  bail?: boolean;
  keepFile?: boolean;
  testNamePattern?: string;
  disableCertValidation?: boolean;
};

function validateOptions({ reporter }: Partial<RunTestsOptions>): boolean {
  if (reporter && !reporterTypesSet.has(reporter)) {
    logger.fatal(`Reporter "${reporter}" not unrecognized. Options are [${reporterTypes.join(', ')}].`);
    return false;
  }

  return true;
}

const createTestSuite = (dbSuite: UnitTestSuite, dbTests: UnitTest[]): TestSuite => ({
  name: dbSuite.name,
  suites: [],
  tests: dbTests.map(({ name, code, requestId }) => ({
    name,
    code,
    defaultRequestId: requestId,
  })),
});

// Identifier can be the id or name of a workspace, apiSpec, or unit test suite
export async function runInsomniaTests(
  identifier: string | null | undefined,
  options: Partial<RunTestsOptions>,
) {
  if (!validateOptions(options)) {
    return false;
  }

  const { reporter, bail, keepFile, appDataDir, workingDir, env, ci, testNamePattern, disableCertValidation, src } = options;
  const db = await loadDb({
    workingDir,
    appDataDir,
    filterTypes: [],
    src,
  });

  // Find suites
  const suites = identifier ? loadTestSuites(db, identifier) : await promptTestSuites(db, !!ci);

  if (!suites.length) {
    logger.fatal('No test suites found; cannot run tests.');
    return false;
  }

  // Find environment
  const workspaceId = suites[0].parentId;
  const environment = env
    ? loadEnvironment(db, workspaceId, env)
    : await promptEnvironment(db, !!ci, workspaceId);

  if (!environment) {
    logger.fatal('No environment identified; cannot run tests without a valid environment.');
    return false;
  }

  // Generate test file
  const testFileContents = generate(
    suites.map(suite =>
      createTestSuite(
        suite,
        db.UnitTest.filter(test => test.parentId === suite._id),
      ),
    ),
  );

  // eslint-disable-next-line @typescript-eslint/no-var-requires -- Load lazily when needed, otherwise this require slows down the entire CLI.
  const { getSendRequestCallbackMemDb } = require('insomnia-send-request');

  const sendRequest = await getSendRequestCallbackMemDb(environment._id, db, { validateSSL: !disableCertValidation });
  return await noConsoleLog(() =>
    runTestsCli(testFileContents, {
      reporter,
      bail,
      keepFile,
      sendRequest,
      testFilter: testNamePattern,
    }),
  );
}
