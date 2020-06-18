// @flow

import Mocha from 'mocha';
import chai from 'chai';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { JavaScriptReporter } from './javaScriptReporter';
import type { Request } from './insomnia';
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
 */
export async function runTests(
  filename: string | Array<string>,
  options: { requests?: Array<Request> } = {},
): Promise<TestResults> {
  return new Promise(resolve => {
    // Add global `insomnia` helper.
    // This is the only way to add new globals to the Mocha environment as far
    // as I can tell
    global.insomnia = new Insomnia(options.requests);
    global.chai = chai;

    const mocha = new Mocha({
      global: ['insomnia', 'chai'],
    });

    mocha.reporter(JavaScriptReporter);

    const filenames = Array.isArray(filename) ? filename : [filename];
    for (const f of filenames) {
      mocha.addFile(writeTempFile(f));
    }

    const runner = mocha.run(() => {
      resolve(runner.testResults);

      // Remove global since we don't need it anymore
      delete global.insomnia;
      delete global.chai;
    });
  });
}

/**
 * Copy test to tmp dir and return the file path
 * @param filename
 */
function writeTempFile(filename: string): string {
  const p = path.join(os.tmpdir(), `${Math.random()}-test.js`);
  fs.copyFileSync(filename, p);
  return p;
}
