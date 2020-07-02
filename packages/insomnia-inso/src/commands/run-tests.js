// @flow

import { generate, runTestsCli } from 'insomnia-testing';
import { getSendRequestCallbackMemDb } from 'insomnia-send-request';
import type { GlobalOptions } from '../util';
import { findFirst, findSingle, loadDb } from '../db';
import { getTestSuiteFromIdentifier } from '../db/prompts';
import type { UnitTest, UnitTestSuite } from '../db/types';

export const TestReporterEnum = {
  dot: 'dot',
  list: 'list',
  spec: 'spec',
  min: 'min',
  progress: 'progress',
};

export type RunTestsOptions = GlobalOptions & {
  reporter: $Keys<typeof TestReporterEnum>,
  bail?: boolean,
  keepFile?: boolean,
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
  tests: dbTests.map(({ name, code, requestId }) => ({ name, code, requestId })),
});

export async function runInsomniaTests(
  identifier?: string,
  options: RunTestsOptions,
): Promise<boolean> {
  if (!validateOptions(options)) {
    return false;
  }

  const { reporter, bail, keepFile, appDataDir, workingDir } = options;

  const db = await loadDb({ workingDir, appDataDir });

  // Find suite
  const suite = await getTestSuiteFromIdentifier(db, identifier);

  if (!suite) {
    console.log('No test suite identified.');
    return false;
  }

  // Find tests in suite
  const tests = db.UnitTest.filter(t => t.parentId === suite._id);

  if (!tests.length) {
    console.log(`Test suite "${suite.name}" contains no tests.`);
    return false;
  }

  // Make this nicer, I think...
  const workspaceId = suite.parentId;
  const baseEnv = findSingle(db.Environment, ({ parentId }) => parentId === workspaceId);
  const firstSubEnv = findFirst(db.Environment, ({ parentId }) => parentId === baseEnv._id);

  const testFileContents = await generate([createTestSuite(suite, tests)]);
  const sendRequest = await getSendRequestCallbackMemDb(firstSubEnv._id, db);
  return await runTestsCli(testFileContents, { reporter, bail, keepFile, sendRequest });
}
