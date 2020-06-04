// @flow

import Mocha from 'mocha';
import { Reporter } from './reporter';

/**
 * Run a test file using Mocha
 *
 * @param filename
 * @returns {Promise<R>}
 */
export async function runMochaTests(...filename: Array<string>): Promise<Object> {
  return new Promise(resolve => {
    const m = new Mocha();

    m.reporter(Reporter);

    for (const f of filename) {
      m.addFile(f);
    }

    const runner = m.run(() => {
      resolve(runner.testResults);
    });
  });
}
