// @flow

import type { GlobalOptions } from '../util';
import { runTestsCli, generate } from 'insomnia-testing';

export const TestReporterEnum = {
  dot: 'dot',
  list: 'list',
  spec: 'spec',
  min: 'min',
  progress: 'progress',
};

export type RunTestsOptions = GlobalOptions<{|
  reporter: $Keys<typeof TestReporterEnum>,
  bail?: boolean,
  keepFile?: boolean,
|}>;

function validateOptions({ reporter }: RunTestsOptions): boolean {
  if (reporter && !TestReporterEnum[reporter]) {
    const reporterTypes = Object.keys(TestReporterEnum).join(', ');
    console.log(`Reporter "${reporter}" not unrecognized. Options are [${reporterTypes}].`);
    return false;
  }

  return true;
}

export async function runInsomniaTests(options: RunTestsOptions): Promise<void> {
  if (!validateOptions(options)) {
    return;
  }

  const { reporter, bail, keepFile } = options;

  const suites = [
    {
      name: 'Parent Suite',
      suites: [
        {
          name: 'Nested Suite',
          tests: [
            {
              name: 'should return -1 when the value is not present',
              code: 'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.equal(true);',
            },
            {
              name: 'should fail',
              code: 'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.equal(false);',
            },
          ],
        },
      ],
    },
  ];

  const testFileContents = await generate(suites);
  return await runTestsCli(testFileContents, { reporter, bail, keepFile });
}
