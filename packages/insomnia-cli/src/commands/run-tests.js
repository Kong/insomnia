// @flow

import { generate, runTestsCli } from 'insomnia-testing';
import { getSendRequestCallback } from 'insomnia-send-request';
import type { GlobalOptions } from '../util';
import { gitDataDirDb } from '../db/mem-db';

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

export async function runInsomniaTests(options: RunTestsOptions): Promise<void> {
  if (!validateOptions(options)) {
    return;
  }

  const { reporter, bail, keepFile } = options;

  const workingDir = options.workingDir || '.';

  const db = await gitDataDirDb({
    dir: workingDir,
    filterTypes: ['Environment', 'Request', 'RequestGroup', 'Workspace'],
  });

  const suites = [
    {
      name: 'Parent Suite',
      suites: [
        {
          name: 'Nested Suite',
          tests: [
            {
              name: 'should return -1 when the value is not present',
              code:
                `const resp = await insomnia.send('req_wrk_012d4860c7da418a85ffea7406e1292a21946b60');\n` +
                'expect(resp.status).to.equal(200);',
            },
          ],
        },
      ],
    },
  ];

  const dbObj = {};
  for (const type of Object.keys(db)) {
    dbObj[type] = {};
    for (const [id, doc] of db[type].entries()) {
      dbObj[type][id] = doc;
    }
  }

  const testFileContents = await generate(suites);
  const sendRequest = getSendRequestCallback(
    'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub',
    dbObj,
  );
  return await runTestsCli(testFileContents, { reporter, bail, keepFile, sendRequest });
}
