// @flow

import type { GlobalOptions } from '../util';
import { runTests, generate } from 'insomnia-testing';
import path from 'path';
import os from 'os';
import fs from 'fs';

export type RunTestsOptions = GlobalOptions<{||}>;

export async function runInsomniaTests(_: RunTestsOptions): Promise<void> {
  const suites = [
    {
      name: 'Parent Suite',
      suites: [
        {
          name: 'Nested Suite',
          tests: [
            {
              name: 'should return -1 when the value is not present',
              code: 'expect([1, 2, 3].indexOf(4)).toBe(-1);\nexpect(true).toBe(true);',
            },
          ],
        },
      ],
    },
  ];

  const testFileContents = generate(suites);

  const tmpPath = path.join(os.tmpdir(), `${Math.random()}.test.js`);
  fs.writeFileSync(tmpPath, testFileContents);

  const results = await runTests(tmpPath);

  console.log(results.failures[0].err);

  fs.unlinkSync(tmpPath);
}
