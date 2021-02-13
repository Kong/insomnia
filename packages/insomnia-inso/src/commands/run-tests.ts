import { generate, runTestsCli, TestSuite } from 'insomnia-testing';
import type { GlobalOptions } from '../get-options';
import { loadDb } from '../db';
import type { UnitTest, UnitTestSuite } from '../db/models/types';
import { logger, noConsoleLog } from '../logger';
import { loadTestSuites, promptTestSuites } from '../db/models/unit-test-suite';
import { loadEnvironment, promptEnvironment } from '../db/models/environment';

export const TestReporterEnum = ['dot', 'list', 'spec', 'progress', 'min'];

export type RunTestsOptions = GlobalOptions & {
  env?: string;
  reporter?: string;
  bail?: boolean;
  keepFile?: boolean;
  testNamePattern?: string;
};

function warnAboutValidReporters({ reporter }: RunTestsOptions): void {
  if (reporter && !TestReporterEnum.includes(reporter)) {
    logger.info(`Reporter "${reporter}" is not recognized and is treated as external`);
    logger.info('If possible, consider using default --reporter values');
  }
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
  warnAboutValidReporters(options);

  const { reporter, bail, keepFile, appDataDir, workingDir, env, ci, testNamePattern } = options;
  const db = await loadDb({
    workingDir,
    appDataDir,
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

  const sendRequest = await getSendRequestCallbackMemDb(environment._id, db);
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
