// @flow

import type { TestResults } from '../index';
import { runTests } from '../index';

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
    const { stats } = await runTests(exampleTest);
    expect(stats.passes).toBe(1);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(1);
  });

  it('works on multiple files', async () => {
    const { stats } = await runTests([exampleTest, exampleTest]);
    expect(stats.passes).toBe(2);
    expect(stats.tests).toBe(4);
    expect(stats.failures).toBe(2);
  });

  it('calls sendRequest() callback', async () => {
    const sendRequest = jest.fn(() => Promise.resolve({ status: 200 }));
    const { stats }: TestResults = await runTests(exampleTestWithRequest, {
      requests: [{ _id: 'req_123' }],
      sendRequest,
    });
    expect(sendRequest).toHaveBeenCalledWith('req_123');
    expect(stats.passes).toBe(1);
  });

  it('fails sendRequest() with invalid request', async () => {
    const sendRequest = jest.fn();
    const { stats, failures }: TestResults = await runTests(exampleTestWithRequest, {
      requests: [{ _id: 'blah' }],
      sendRequest,
    });
    expect(sendRequest).toHaveBeenCalledTimes(0);
    expect(stats.failures).toBe(1);
    expect(failures[0].err.message || '').toBe('Failed to find request by ID req_123');
  });
});
