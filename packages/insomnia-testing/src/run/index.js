// @flow

import Mocha from 'mocha';
import chai from 'chai';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { JavaScriptReporter } from './java-script-reporter';
import type { InsomniaOptions } from './insomnia';
import Insomnia from './insomnia';

type TestErr = {
  generatedMessage: boolean,
  name: string,
  code: string,
  actual: string,
  expected: string,
  operator: string,
};

type NodeErr = {
  message: string,
  stack: string,
};

type TestResult = {
  title: string,
  fullTitle: string,
  file: string,
  duration: number,
  currentRetry: number,
  err: TestErr | NodeErr | {},
};

export type TestResults = {
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
  options: InsomniaOptions = {},
): Promise<TestResults> {
  return new Promise(resolve => {
    // Add global `insomnia` helper.
    // This is the only way to add new globals to the Mocha environment as far
    // as I can tell
    global.insomnia = new Insomnia(options);
    global.chai = chai;

    const mocha = new Mocha({
      timeout: 5000,
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
