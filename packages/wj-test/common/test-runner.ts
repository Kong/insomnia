// frameworks/-test-runner.ts
import fs, { existsSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'csv-parse/sync';

import { test } from './app';

export type TestCaseFunction = (params: {
  page: any;
  record: any;
}) => Promise<void>;

export const TestRunner = {
  async runTest(
    testFile: string,
    testName: string,
    testFunction: TestCaseFunction,
    options: { parallel?: boolean } = {}
  ) {
    const currentFile = path.basename(testFile);
    const dataFile = currentFile.replace('.test.ts', '') + '_data.csv';
    const dataFilePath = path.join(path.dirname(testFile), dataFile);
    const testDescribe = options.parallel ? test.describe.parallel : test.describe;

    if (existsSync(dataFilePath)) {
      const records = parse(fs.readFileSync(dataFilePath), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      testDescribe(testName, () => {
        for (const [i, record] of records.entries()) {
          test(`Test ${i + 1} - ${record.test_case}`, async ({ page }) => {
            await testFunction({ page, record });
          });
        }
      });
    } else {
      // console.log(`\tRun test WITHOUT data file: ${dataFilePath}`);

      testDescribe(testName, () => {
        test(testName, async ({ page }) => {
          await testFunction({ page, record: {} });
        });
      });

    }
  },
};
