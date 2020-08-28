// @flow

import Mocha from 'mocha';
import chai from 'chai';
import os from 'os';
import fs from 'fs';
import mkdirp from 'mkdirp';
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

type Reporter = 'dot' | 'list' | 'spec' | 'min' | 'progress';

async function runInternal<T>(
  testSrc: string | Array<string>,
  options: InsomniaOptions,
  reporter: Reporter | Function,
  extractResult: (runner: Object) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const { bail, keepFile, testFilter } = options;
    // Add global `insomnia` helper.
    // This is the only way to add new globals to the Mocha environment as far
    // as I can tell
    global.insomnia = new Insomnia(options);
    global.chai = chai;

    const mocha = new Mocha({
      timeout: 5000,
      global: ['insomnia', 'chai'],
      bail,
      reporter,
      fgrep: testFilter,
    });

    const sources = Array.isArray(testSrc) ? testSrc : [testSrc];
    for (const src of sources) {
      mocha.addFile(writeTempFile(src));
    }

    try {
      const runner = mocha.run(() => {
        resolve(extractResult(runner));

        // Remove global since we don't need it anymore
        delete global.insomnia;
        delete global.chai;

        if (keepFile && mocha.files.length) {
          console.log(`Test files: ${JSON.stringify(mocha.files)}.`);
          return;
        }

        // Clean up temp files
        for (const f of mocha.files) {
          fs.unlink(f, err => {
            if (err) {
              console.log('Failed to clean up test file', f, err);
            }
          });
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Copy test to tmp dir and return the file path
 * @param src - source code to write to file
 */
function writeTempFile(src: string): string {
  const root = path.join(os.tmpdir(), 'insomnia-testing');
  mkdirp.sync(root);
  const p = path.join(root, `${Math.random()}-test.js`);
  fs.writeFileSync(p, src);
  return p;
}

type CliOptions = InsomniaOptions & {
  reporter?: Reporter,
};

/**
 * Run a test file using Mocha
 */
export async function runTestsCli(
  testSrc: string | Array<string>,
  { reporter, ...options }: CliOptions = {},
): Promise<boolean> {
  return await runInternal(testSrc, options, reporter, runner => !runner.stats.failures);
}

/**
 * Run a test file using Mocha and returns JS results
 */
export async function runTests(
  testSrc: string | Array<string>,
  options: InsomniaOptions = {},
): Promise<TestResults> {
  return await runInternal(testSrc, options, JavaScriptReporter, runner => runner.testResults);
}
