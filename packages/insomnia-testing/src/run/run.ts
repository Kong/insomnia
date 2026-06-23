import { unlink, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import * as chai from 'chai';
import type { Reporter, ReporterConstructor } from 'mocha';
import Mocha from 'mocha';

import type { InsomniaOptions } from './insomnia';
import { Insomnia } from './insomnia';
import { JavaScriptReporter } from './javascript-reporter';

function prependInterceptedRequireToSource(source: string): string {
  const injectScript = `
  const externalModules = new Map([['chai', global.chai], ['chai-json-schema', global.chaiJSONSchema]]);

  const requireInterceptor = (moduleName) => {
    if (
      [
        // node.js modules
        'path',
        'assert',
        'buffer',
        'util',
        'url',
        'punycode',
        'querystring',
        'string_decoder',
        'stream',
        'timers',
        'events',
        // follows should be npm modules
        // but they are moved to here to avoid introducing additional dependencies
      ].includes(moduleName)
    ) {
      return require(moduleName);
    } else if (['atob', 'btoa'].includes(moduleName)) {
      return moduleName === 'atob' ? atob : btoa;
    } else if (externalModules.has(moduleName)) {
      const externalModule = externalModules.get(moduleName);
      if (!externalModule) {
        throw Error(\`no module is found for "$\{moduleName}"\`);
      }
      return externalModule;
    }
  
    throw Error(\`no module is found for "$\{moduleName}"\`);
  };

  require = requireInterceptor;
  `;

  // Ensure that the require is at the top of the file
  return `${injectScript}\n${source}`;
}

// declare var insomnia: Insomnia;
const runInternal = async <TReturn, TNetworkResponse>(
  testSrc: string | string[],
  options: InsomniaOptions<TNetworkResponse>,
  reporter: Reporter | ReporterConstructor = 'spec',
  extractResult: (runner: Mocha.Runner) => TReturn,
) =>
  new Promise<TReturn>((resolve, reject) => {
    const { bail, keepFile, testFilter } = options;

    // Add global `insomnia` helper.
    // This is the only way to add new globals to the Mocha environment as far as I can tell
    // @ts-expect-error -- global hack
    global.insomnia = new Insomnia(options);

    chai.use(require('chai-json-schema'));
    // @ts-expect-error -- global hack
    global.chai = chai;
    // @ts-expect-error -- global hack
    global.chaiJSONSchema = require('chai-json-schema');

    const mocha: Mocha = new Mocha({
      //       ms   * sec * min
      timeout: 1000 * 60 * 1,
      globals: ['insomnia', 'chai'],
      bail,
      reporter,
      fgrep: testFilter,
    });

    const sources = Array.isArray(testSrc) ? testSrc : [testSrc];
    sources.forEach(source => {
      mocha.addFile(writeTempFile(prependInterceptedRequireToSource(source)));
    });

    try {
      const runner = mocha.run(() => {
        resolve(extractResult(runner));

        // Remove global since we don't need it anymore
        // @ts-expect-error -- global hack
        delete global.insomnia;
        // @ts-expect-error -- global hack
        delete global.chai;
        // @ts-expect-error -- global hack
        delete global.chaiJSONSchema;

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
  const root = nodePath.join(tmpdir(), 'insomnia-testing');
  fs.mkdirSync(root, { recursive: true });

  const path = nodePath.join(root, `${crypto.randomUUID()}-test.ts`);
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
) => runInternal(testSrc, options, reporter, runner => !runner.stats?.failures);

/**
 * Run a test file using Mocha and returns JS results
 */
export const runTests = async <TNetworkResponse>(
  testSrc: string | string[],
  options: InsomniaOptions<TNetworkResponse>,
) =>
  runInternal(
    testSrc,
    options,
    JavaScriptReporter,
    // @ts-expect-error the `testResults` property is added onto the runner by the JavascriptReporter
    runner => runner.testResults as TestResults,
  );
