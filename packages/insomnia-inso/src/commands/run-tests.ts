import { generate, runTestsCli } from 'insomnia-testing';

import { type GlobalOptions, logger } from '../cli';
import { loadDb } from '../db';
import { loadEnvironment, promptEnvironment } from '../db/models/environment';
import { loadTestSuites, promptTestSuites } from '../db/models/unit-test-suite';

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

const noConsoleLog = async <T>(callback: () => Promise<T>): Promise<T> => {
  const oldConsoleLog = console.log;
  console.log = () => { };
  try {
    return await callback();
  } finally {
    console.log = oldConsoleLog;
  }
};

// Identifier can be the id or name of a workspace, apiSpec, or unit test suite
export async function runInsomniaTests(
  identifier: string | null | undefined,
  options: {
    env?: string;
    reporter: TestReporter;
    bail?: boolean;
    keepFile?: boolean;
    testNamePattern?: string;
    disableCertValidation?: boolean;
    pathToSearch: string;
    ci: boolean;
  }
) {
  if (options.reporter && !reporterTypesSet.has(options.reporter)) {
    logger.fatal(`Reporter "${options.reporter}" not unrecognized. Options are [${reporterTypes.join(', ')}].`);
    return false;
  }

  const { reporter, bail, keepFile, env, ci, testNamePattern, disableCertValidation, pathToSearch } = options;
  const db = await loadDb({
    pathToSearch,
    filterTypes: [],
  });

  // Find suites
  const suites = identifier ? loadTestSuites(db, identifier) : await promptTestSuites(db, !!ci);

  if (!suites.length) {
    logger.fatal('No test suites found; cannot run tests.');
    return false;
  }

  // Find environment
  const workspaceId = suites[0].parentId;
  const environment = env ? loadEnvironment(db, workspaceId, env) : await promptEnvironment(db, !!ci, workspaceId);

  if (!environment) {
    logger.fatal('No environment identified; cannot run tests without a valid environment.');
    return false;
  }

  // lazy import
  const { getSendRequestCallbackMemDb } = await import('insomnia-send-request');
  const sendRequest = await getSendRequestCallbackMemDb(environment._id, db, { validateSSL: !disableCertValidation });
  // Generate test file
  const testFileContents = generate(suites.map(suite => ({
    name: suite.name,
    suites: [],
    tests: db.UnitTest.filter(test => test.parentId === suite._id)
      .sort((a, b) => a.metaSortKey - b.metaSortKey)
      .map(({ name, code, requestId }) => ({ name, code, defaultRequestId: requestId })),
  })));

  const res = runTestsCli(testFileContents, {
    reporter,
    bail,
    keepFile,
    sendRequest,
    testFilter: testNamePattern,
  });

  return options.verbose ? res : noConsoleLog(() => res);
}
