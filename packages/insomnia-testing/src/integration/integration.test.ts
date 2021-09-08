
import { generate } from '../generate';
import { runTests } from '../run';
import { mockedSendRequest, mockedSendRequestMultiple } from '../test-helpers/send-request-mock';

describe('integration', () => {
  it('generates and runs basic tests', async () => {
    const testSrc = generate([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code:
              'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.equal(true);',
            defaultRequestId: null,
          },
          {
            name: 'is an empty test',
            code: '',
            defaultRequestId: null,
          },
        ],
      },
    ]);
    const sendRequest = mockedSendRequest();

    const { stats, failures } = await runTests(testSrc, { sendRequest });
    expect(failures).toEqual([]);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);
  });

  it('generates and runs more than once', async () => {
    const testSrc = generate([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code:
              'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.be.true;',
            defaultRequestId: null,
          },
          {
            name: 'is an empty test',
            code: '',
            defaultRequestId: null,
          },
        ],
      },
    ]);

    const sendRequest = mockedSendRequest();

    const { stats, failures } = await runTests(testSrc, { sendRequest });
    expect(failures).toEqual([]);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);

    const { stats: stats2, failures: failures2 } = await runTests(testSrc, { sendRequest });
    expect(failures2).toEqual([]);
    expect(stats2.tests).toBe(2);
    expect(stats2.failures).toBe(0);
    expect(stats2.passes).toBe(2);
  });

  it('sends an HTTP request', async () => {
    const response1 = {
      status: 200,
      statusMessage: 'abc',
    };

    const response2 = {
      status: 301,
      statusMessage: 'def',
    };

    const sendRequest = mockedSendRequestMultiple(response1, response2);

    const testSrc = generate([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'Tests referencing request by ID',
            defaultRequestId: null,
            code: [
              'const resp = await insomnia.send(\'foo\');',
              'expect(resp.status).to.equal(200);',
              'expect(resp.statusMessage).to.equal(\'abc\');',
            ].join('\n'),
          },
          {
            name: 'Tests referencing default request',
            defaultRequestId: 'bar',
            code: [
              'const resp = await insomnia.send();',
              'expect(resp.status).to.equal(301);',
              'expect(resp.statusMessage).to.equal(\'def\');',
            ].join('\n'),
          },
        ],
      },
    ]);

    const { stats, failures, passes } = await runTests(testSrc, { sendRequest });

    expect(failures).toEqual([]);
    expect(passes.length).toBe(2);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);

    expect(sendRequest).toHaveBeenNthCalledWith(1, 'foo');
    expect(sendRequest).toHaveBeenNthCalledWith(2, 'bar');
  });
});
