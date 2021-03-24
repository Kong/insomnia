import Mocha, { Reporter, ReporterConstructor } from 'mocha';
import chai from 'chai';
import { tmpdir } from 'os';
import { writeFileSync, unlink } from 'fs';
import { sync } from 'mkdirp';
import { join } from 'path';
import { JavaScriptReporter } from './javascript-reporter';
import Insomnia, { InsomniaOptions } from './insomnia';

declare global {
  namespace NodeJS {
    interface Global {
      insomnia?: Insomnia;
      chai?: typeof chai;
    }
  }
}

const runInternal = async <T>(
  testSrc: string | string[],
  options: InsomniaOptions,
  reporter: Reporter | ReporterConstructor = 'spec',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type not available, and postponing anyway until the impending move to all jest (and no mocha)
  extractResult: (runner: { [key: string]: any }) => T,
): Promise<T> => new Promise((resolve, reject) => {
  const { bail, keepFile, testFilter } = options;

  // Add global `insomnia` helper.
  // This is the only way to add new globals to the Mocha environment as far as I can tell
  global.insomnia = new Insomnia(options);
  global.chai = chai;

  const mocha: Mocha = new Mocha({
    timeout: 5000,
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

type CliOptions = InsomniaOptions & {
  reporter?: Reporter
}

/**
 * Run a test file using Mocha
 */
export const runTestsCli = async (
  testSrc: string | string[],
  { reporter, ...options }: CliOptions = {},
) => runInternal(
  testSrc,
  options,
  reporter,
  runner => !runner.stats.failures,
);

/**
 * Run a test file using Mocha and returns JS results
 */
export const runTests = async <T>(
  testSrc: string | string[],
  options: InsomniaOptions = {},
) => runInternal<T>(
  testSrc,
  options,
  JavaScriptReporter,
  runner => runner.testResults,
);
