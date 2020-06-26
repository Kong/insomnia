// @flow

import { runTests } from '../index';
import os from 'os';
import fs from 'fs';
import path from 'path';
import type { TestResults } from '../index';

const exampleTest = `
const assert = require('assert');
describe('Example', () => {
  it('should be true', async () => assert.equal(true, true));
  it('should fail', async () => assert.equal(true, false));
});
`;

const exampleTestWithRequest = `
const assert = require('assert');
describe('Example', () => {
  it('should be true', async () => {
    const resp = await insomnia.send('req_123');
    assert.equal(resp.status, 200);
  });
});
`;

describe('run', () => {
  it('runs a mocha suite', async () => {
    const testPath = writeToTmp(exampleTest);

    const { stats } = await runTests(testPath);
    expect(stats.passes).toBe(1);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(1);
  });

  it('works on multiple files', async () => {
    const testPath1 = writeToTmp(exampleTest);
    const testPath2 = writeToTmp(exampleTest);

    const { stats } = await runTests([testPath1, testPath2]);
    expect(stats.passes).toBe(2);
    expect(stats.tests).toBe(4);
    expect(stats.failures).toBe(2);
  });

  it('calls sendRequest() callback', async () => {
    const testPath = writeToTmp(exampleTestWithRequest);

    const sendRequest = jest.fn(() => Promise.resolve({ status: 200 }));
    const { stats }: TestResults = await runTests(testPath, {
      requests: [{ _id: 'req_123' }],
      sendRequest,
    });
    expect(sendRequest).toHaveBeenCalledWith('req_123');
    expect(stats.passes).toBe(1);
  });

  it('fails sendRequest() with invalid request', async () => {
    const testPath = writeToTmp(exampleTestWithRequest);

    const sendRequest = jest.fn();
    const { stats, failures }: TestResults = await runTests(testPath, {
      requests: [{ _id: 'blah' }],
      sendRequest,
    });
    expect(sendRequest).toHaveBeenCalledTimes(0);
    expect(stats.failures).toBe(1);
    expect(failures[0].err.message || '').toBe('Failed to find request by ID req_123');
  });
});

function writeToTmp(contents: string): string {
  const tmpPath = path.join(os.tmpdir(), `${Math.random()}.test.js`);
  fs.writeFileSync(tmpPath, contents);
  return tmpPath;
}
