import chai from 'chai';
import { unlink, writeFileSync } from 'fs';
import { sync } from 'mkdirp';
import Mocha, { Reporter, ReporterConstructor } from 'mocha';
import { tmpdir } from 'os';
import { join } from 'path';

import { TestResults } from './entities';
import { Insomnia, InsomniaOptions } from './insomnia';
import { JavaScriptReporter } from './javascript-reporter';

declare global {
  namespace NodeJS {
    interface Global {
      insomnia?: Insomnia;
      chai?: typeof chai;
    }
  }
}

const runInternal = async <TReturn, TNetworkResponse>(
  testSrc: string | string[],
  options: InsomniaOptions<TNetworkResponse>,
  reporter: Reporter | ReporterConstructor = 'spec',
  extractResult: (runner: Mocha.Runner) => TReturn,
) => new Promise<TReturn>((resolve, reject) => {
  const { bail, keepFile, testFilter } = options;

  // Add global `insomnia` helper.
  // This is the only way to add new globals to the Mocha environment as far as I can tell
  global.insomnia = new Insomnia(options);
  global.chai = chai;

  const mocha: Mocha = new Mocha({
    //       ms   * sec * min
    timeout: 1000 * 60  * 1,
    globals: ['insomnia', 'chai'],
    bail,
    reporter,
    // @ts-expect-error https://github.com/DefinitelyTyped/DefinitelyTyped/pull/51770
    fgrep: testFilter,
  });

  const sources = Array.isArray(testSrc) ? testSrc : [testSrc];
  sources.forEach(source => {
    mocha.addFile(writeTempFile(source));
  });

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
      mocha.files.forEach(file => {
        unlink(file, err => {
          if (err) {
            console.log('Failed to clean up test file', file, err);
          }
        });
      });
    });
  } catch (err) {
    reject(err);
  }
});

/**
 * Copy test to tmp dir and return the file path
 */
const writeTempFile = (sourceCode: string) => {
  const root = join(tmpdir(), 'insomnia-testing');
  sync(root);
  const path = join(root, `${Math.random()}-test.ts`);
  writeFileSync(path, sourceCode);
  return path;
};

type CliOptions<TNetworkResponse> = InsomniaOptions<TNetworkResponse> & {
  reporter?: Reporter;
};

/**
 * Run a test file using Mocha
 */
export const runTestsCli = async <TNetworkResponse>(
  testSrc: string | string[],
  { reporter, ...options }: CliOptions<TNetworkResponse>,
) => runInternal(
  testSrc,
  options,
  reporter,
  runner => !Boolean(runner.stats?.failures),
);

/**
 * Run a test file using Mocha and returns JS results
 */
export const runTests = async <TNetworkResponse>(
  testSrc: string | string[],
  options: InsomniaOptions<TNetworkResponse>,
) => runInternal(
  testSrc,
  options,
  JavaScriptReporter,
  // @ts-expect-error the `testResults` property is added onto the runner by the JavascriptReporter
  runner => runner.testResults as TestResults,
);
