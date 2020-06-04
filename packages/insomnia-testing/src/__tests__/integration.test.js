// @flow
import { generateToTmpFile } from '../generate';
import { runTests } from '../run';

describe('integration', () => {
  it('generates and runs basic tests', async () => {
    const testFilename = await generateToTmpFile([
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

    const { stats } = await runTests(testFilename);

    expect(stats.passes).toBe(2);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
  });
});
