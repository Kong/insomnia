// @flow

import type { GlobalOptions } from '../util';
import { runTestsCli, generateToFile } from 'insomnia-testing';
import path from 'path';
import os from 'os';
import fs from 'fs';

export const TestReporterEnum = {
  dot: 'dot',
  list: 'list',
  spec: 'spec',
  min: 'min',
  progress: 'progress',
};

export type RunTestsOptions = GlobalOptions & {
  reporter: $Keys<typeof TestReporterEnum>,
  bail?: boolean,
  keepFile?: boolean,
};

function validateOptions({ reporter }: RunTestsOptions): boolean {
  if (reporter && !TestReporterEnum[reporter]) {
    const reporterTypes = Object.keys(TestReporterEnum).join(', ');
    console.log(`Reporter "${reporter}" not unrecognized. Options are [${reporterTypes}].`);
    return false;
  }

  return true;
}

async function deleteTestFile(filePath: string, { keepFile }: RunTestsOptions): Promise<void> {
  if (!filePath) {
    return;
  }

  if (!keepFile) {
    await fs.promises.unlink(filePath);
    return;
  }

  console.log(`Test file at ${path.normalize(filePath)}`);
}

async function generateTestFile(_: RunTestsOptions): Promise<string> {
  // TODO: Read from database
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
      tests: [
        {
          name: 'should return index when value is present',
          code: 'expect([1, 2, 3].indexOf(3)).toBe(2);\nexpect(true).toBe(true);',
        },
      ],
    },
  ];

  // TODO: Should this generate the test file at the working-dir? I think not
  const tmpPath = path.join(os.tmpdir(), 'insomnia-cli', `${Math.random()}.test.js`);
  await fs.promises.mkdir(path.dirname(tmpPath), { recursive: true });
  await generateToFile(tmpPath, suites);

  return tmpPath;
}

export async function runInsomniaTests(options: RunTestsOptions): Promise<boolean> {
  if (!validateOptions(options)) {
    return true;
  }

  const { reporter, bail } = options;

  let tmpPath = '';

  try {
    tmpPath = await generateTestFile(options);

    const results = await runTestsCli(tmpPath, { reporter, bail });

    if (!results || results.stats.failures) {
      return false;
    }
  } finally {
    await deleteTestFile(tmpPath, options);
  }

  return true;
}
