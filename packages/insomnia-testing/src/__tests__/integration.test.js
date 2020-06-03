// @flow
import { generate } from '../generate';
import { runSuite } from '../run';
import path from 'path';
import os from 'os';
import fs from 'fs';

describe('integration', () => {
  it('generates and runs basic tests', async () => {
    const mochaJs = await generate([
      {
        name: 'Example Suite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code: 'assert.equal([1, 2, 3].indexOf(4), -1);\nassert.equal(true, true);',
          },
          {
            name: 'is an empty test',
            code: '',
          },
        ],
      },
    ]);

    const testPath = path.join(os.tmpdir(), `${Math.random()}.test.js`);
    fs.writeFileSync(testPath, mochaJs);

    const { stats } = await runSuite(testPath);

    expect(stats.passes).toBe(2);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
  });
});
