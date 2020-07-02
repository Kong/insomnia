// @flow

import { generate, runTestsCli } from 'insomnia-testing';
import { getSendRequestCallbackMemDb } from 'insomnia-send-request';
import type { GlobalOptions } from '../util';
import { loadDb } from '../db';

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

export async function runInsomniaTests(options: RunTestsOptions): Promise<boolean> {
  if (!validateOptions(options)) {
    return false;
  }

  const { reporter, bail, keepFile, appDataDir, workingDir } = options;

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

  const db = await loadDb({
    workingDir,
    appDataDir,
    filterTypes: ['Environment', 'Request', 'RequestGroup', 'Workspace'],
  });

  const environmentId = 'env_env_ca046a738f001eb3090261a537b1b78f86c2094c_sub';
  const testFileContents = await generate(suites);
  const sendRequest = await getSendRequestCallbackMemDb(environmentId, db);
  return await runTestsCli(testFileContents, { reporter, bail, keepFile, sendRequest });
}
