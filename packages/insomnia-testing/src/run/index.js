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

type JavascriptTestResults = {
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

type TestOptions = {
  requests?: { [string]: Request },
  bail?: boolean,
};

type CliOptions = {
  reporter?: 'dot' | 'list' | 'spec' | 'min' | 'progress',
};

async function runInternal<T>(
  filename: string | Array<string>,
  options: TestOptions,
  reporter: string | Function,
  extractResult: (runner: Object) => T,
): Promise<T> {
  return new Promise(resolve => {
    const { requests, bail } = options;
    // Add global `insomnia` helper.
    // This is the only way to add new globals to the Mocha environment as far
    // as I can tell
    global.insomnia = new Insomnia(requests);

    const mocha = new Mocha({
      global: ['insomnia'],
      bail,
      reporter,
    });

    const filenames = Array.isArray(filename) ? filename : [filename];
    for (const f of filenames) {
      mocha.addFile(f);
    }

    const runner = mocha.run(() => {
      resolve(extractResult(runner));

      // Remove global since we don't need it anymore
      delete global.insomnia;
    });
  });
}

/**
 * Run a test file using Mocha
 */
export async function runTestsCli(
  filename: string | Array<string>,
  { reporter, ...options }: TestOptions & CliOptions = {},
): Promise<boolean> {
  return await runInternal(filename, options, reporter, runner => runner.stats.failures !== 0);
}

/**
 * Run a test file using Mocha and returns JS results
 */
export async function runTests(
  filename: string | Array<string>,
  options: TestOptions = {},
): Promise<JavascriptTestResults> {
  return await runInternal(filename, options, JavaScriptReporter, runner => runner.testResults);
}
