import { mocked } from 'ts-jest/utils';

import { SendRequestCallback } from './insomnia';
import { runTests } from './run';

const exampleTest = `
const { expect } = chai;
describe('Example', () => {
  it('should be true', async () => expect(true).to.equal(true));
  it('should fail', async () => expect(true).to.equal(false));
});
`;

const exampleTestWithRequest = `
const { expect } = chai;
describe('Example', () => {
  it('should be true', async () => {
    const resp = await insomnia.send('req_123');
    expect(resp.status).to.equal(200);
  });
});
`;

const exampleEmptySuite = `
const { expect } = chai;
describe('Example', () => {
});
`;

describe('run', () => {
  const getMockedSendRequest = () => mocked<SendRequestCallback<{status: number}>>(jest.fn().mockResolvedValue({ status: 200 }));

  it('runs a mocha suite', async () => {
    const { stats } = await runTests(exampleTest, { sendRequest: getMockedSendRequest() });
    expect(stats.passes).toBe(1);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(1);
  });

  it('runs empty mocha suite', async () => {
    const { stats } = await runTests(exampleEmptySuite, { sendRequest: getMockedSendRequest() });
    expect(stats.passes).toBe(0);
    expect(stats.tests).toBe(0);
    expect(stats.failures).toBe(0);
  });

  it('works on multiple files', async () => {
    const { stats } = await runTests([exampleTest, exampleTest], { sendRequest: getMockedSendRequest() });
    expect(stats.passes).toBe(2);
    expect(stats.tests).toBe(4);
    expect(stats.failures).toBe(2);
  });

  it('calls sendRequest() callback', async () => {
    const sendRequest = getMockedSendRequest();

    const { stats } = await runTests(
      exampleTestWithRequest,
      { sendRequest },
    );

    expect(sendRequest).toHaveBeenCalledWith('req_123');
    expect(stats.passes).toBe(1);
  });

  it('throws on invalid JavaScript', async () => {
    let err;

    try {
      await runTests('this is invalid', { sendRequest: getMockedSendRequest() });
    } catch (e) {
      err = e;
    }

    expect(err).not.toBeNull();
  });
});
