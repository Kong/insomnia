// @flow

import Mocha from 'mocha';
import { JavaScriptReporter } from './javaScriptReporter';
import Insomnia from './insomnia';
import type { Request } from './insomnia';

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
 */
export async function runTests(
  filename: string | Array<string>,
  options: { requests?: { [string]: Request } } = {},
): Promise<TestResults> {
  return new Promise(resolve => {
    // Add global `insomnia` helper.
    // This is the only way to add new globals to the Mocha environment as far
    // as I can tell
    global.insomnia = new Insomnia(options.requests);

    const mocha = new Mocha({
      global: ['insomnia'],
    });

    mocha.reporter(JavaScriptReporter);

    const filenames = Array.isArray(filename) ? filename : [filename];
    for (const f of filenames) {
      mocha.addFile(f);
    }

    const runner = mocha.run(() => {
      resolve(runner.testResults);

      // Remove global since we don't need it anymore
      delete global.insomnia;
    });
  });
}
