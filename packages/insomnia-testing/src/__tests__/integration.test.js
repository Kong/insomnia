// @flow
import axios from 'axios';
import { generate } from '../generate';
import { runTests } from '../run';

jest.mock('axios');

describe('integration', () => {
  it('generates and runs basic tests', async () => {
    const testSrc = await generate([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code: 'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.equal(true);',
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

    const { stats } = await runTests(testSrc);

    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);
  });

  it('generates and runs more than once', async () => {
    const testSrc = await generate([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code: 'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.be.true;',
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

    const { stats, failures } = await runTests(testSrc);
    expect(failures).toEqual([]);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);

    const { stats: stats2 } = await runTests(testSrc);
    expect(failures).toEqual([]);
    expect(stats2.tests).toBe(2);
    expect(stats2.failures).toBe(0);
    expect(stats2.passes).toBe(2);
  });

  it('generates and runs more than once', async () => {
    const testSrc = await generate([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code: 'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.be.true;',
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

    const { stats, failures } = await runTests(testSrc);
    expect(failures).toEqual([]);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);

    const { stats: stats2, failures: failures2 } = await runTests(testSrc);
    expect(failures2).toEqual([]);
    expect(stats2.tests).toBe(2);
    expect(stats2.failures).toBe(0);
    expect(stats2.passes).toBe(2);
  });

  it('sends an HTTP request', async () => {
    axios.__setResponse('GET', '200.insomnia.rest', {
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: { foo: 'bar' },
    });

    axios.__setResponse('GET', '301.insomnia.rest', {
      status: 301,
      headers: { location: '/blog' },
    });

    const testSrc = await generate([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'Tests referencing request by ID',
            defaultRequestId: null,
            code: [
              `const resp = await insomnia.send('req_123');`,
              `expect(resp.status).to.equal(301);`,
            ].join('\n'),
          },
          {
            name: 'Tests referencing default request',
            defaultRequestId: 'req_123',
            code: [
              `const resp = await insomnia.send();`,
              `expect(resp.status).to.equal(301);`,
            ].join('\n'),
          },
        ],
      },
    ]);

    const { stats, failures, passes } = await runTests(testSrc, {
      requests: [
        {
          _id: 'req_123',
          url: '301.insomnia.rest',
          method: 'get',
        },
      ],
    });

    expect(failures).toEqual([]);
    expect(passes.length).toBe(2);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);
  });
});
