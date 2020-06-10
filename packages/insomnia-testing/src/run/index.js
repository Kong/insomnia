// @flow

import Mocha from 'mocha';
import { Reporter } from './reporter';
import Insomnia from './insomnia';

type TestErr = {
  generatedMessage: boolean,
  name: string,
  code: string,
  actual: string,
  expected: string,
  operator: string,
};

type TestResult = {
  title: string,
  fullTitle: string,
  file: string,
  duration: number,
  currentRetry: number,
  err: TestErr | {},
};

type TestResults = {
  stats: {
    suites: number,
    tests: number,
    passes: number,
    pending: number,
    failures: number,
    start: Date,
    end: Date,
    duration: number,
  },
  tests: Array<TestResult>,
  pending: Array<TestResult>,
  failures: Array<TestResult>,
  passes: Array<TestResult>,
};

/**
 * Run a test file using Mocha
 *
 * @param filename
 * @returns {Promise<R>}
 */
export async function runTests(...filename: Array<string>): Promise<TestResults> {
  return new Promise(resolve => {
    // Add global `insomnia` helper.
    // This is the only way to add new globals to the Mocha environment as far
    // as I can tell
    global.insomnia = new Insomnia();

    const m = new Mocha({
      global: ['insomnia'],
    });

    m.reporter(Reporter);

    for (const f of filename) {
      m.addFile(f);
    }

    const runner = m.run(() => {
      resolve(runner.testResults);

      // Remove global since we don't need it anymore
      delete global.insomnia;
    });
  });
}
