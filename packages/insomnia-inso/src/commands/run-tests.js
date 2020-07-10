// @flow

import { generate, runTestsCli } from 'insomnia-testing';
import type { GlobalOptions } from '../util';
import { loadDb } from '../db';
import type { UnitTest, UnitTestSuite } from '../db/models/types';
import { noConsoleLog } from '../logger';
import { loadTestSuites, promptTestSuites } from '../db/models/unit-test-suite';
import { loadEnvironment, promptEnvironment } from '../db/models/environment';

export const TestReporterEnum = {
  dot: 'dot',
  list: 'list',
  spec: 'spec',
  min: 'min',
  progress: 'progress',
};

export type RunTestsOptions = GlobalOptions & {
  env?: string,
  reporter: $Keys<typeof TestReporterEnum>,
  bail?: boolean,
  keepFile?: boolean,
  testNamePattern?: string,
};

function validateOptions({ reporter }: RunTestsOptions): boolean {
  if (reporter && !TestReporterEnum[reporter]) {
    const reporterTypes = Object.keys(TestReporterEnum).join(', ');
    console.log(`Reporter "${reporter}" not unrecognized. Options are [${reporterTypes}].`);
    return false;
  }

  return true;
}

const createTestSuite = (dbSuite: UnitTestSuite, dbTests: Array<UnitTest>) => ({
  name: dbSuite.name,
  tests: dbTests.map(({ name, code, requestId }) => ({ name, code, defaultRequestId: requestId })),
});

// Identifier can be the id or name of a workspace, apiSpec, or unit test suite
export async function runInsomniaTests(
  identifier: ?string,
  options: RunTestsOptions,
): Promise<boolean> {
  if (!validateOptions(options)) {
    return false;
  }

  const { reporter, bail, keepFile, appDataDir, workingDir, env, ci, testNamePattern } = options;

  const db = await loadDb({ workingDir, appDataDir });

  // Find suites
  const suites = identifier ? loadTestSuites(db, identifier) : await promptTestSuites(db, !!ci);

  if (!suites.length) {
    console.log('No test suites identified.');
    return false;
  }

  // Find environment
  const workspaceId = suites[0].parentId;
  const environment = env
    ? loadEnvironment(db, workspaceId, env)
    : await promptEnvironment(db, !!ci, workspaceId);

  if (!environment) {
    console.log('No environment identified.');
    return false;
  }

  // Generate test file
  const testFileContents = await generate(
    suites.map(suite =>
      createTestSuite(
        suite,
        db.UnitTest.filter(t => t.parentId === suite._id),
      ),
    ),
  );

  // Load lazily when needed, otherwise this require slows down the entire CLI.
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
