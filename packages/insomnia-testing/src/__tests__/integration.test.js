// @flow
import axios from 'axios';
import type { TestSuite } from '../generate';
import { generateToFile } from '../generate';
import { runTests } from '../run';
import path from 'path';
import os from 'os';

jest.mock('axios');

describe('integration', () => {
  it('generates and runs basic tests', async () => {
    const testFilename = await generateToTmpFile([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code: 'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.equal(true);',
          },
          {
            name: 'is an empty test',
            code: '',
          },
        ],
      },
    ]);

    const { stats } = await runTests(testFilename);

    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);
  });

  it('generates and runs more than once', async () => {
    const testFilename = await generateToTmpFile([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code: 'expect([1, 2, 3].indexOf(4)).to.equal(-1);\nexpect(true).to.be.true;',
          },
          {
            name: 'is an empty test',
            code: '',
          },
        ],
      },
    ]);

    const { stats, failures } = await runTests(testFilename);
    expect(failures).toEqual([]);
    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);

    const { stats: stats2 } = await runTests(testFilename);
    expect(failures).toEqual([]);
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

    const testFilename = await generateToTmpFile([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'Tests sending a request',
            code: [
              `const resp = await insomnia.send({ url: '200.insomnia.rest' });`,
              `expect(resp.status).to.equal(200);`,
              `expect(resp.headers['content-type']).to.equal('application/json');`,
              `expect(resp.data.foo).to.equal('bar');`,
            ].join('\n'),
          },
          {
            name: 'Tests referencing request by ID',
            code: [
              `const resp = await insomnia.send('req_123');`,
              `expect(resp.status).to.equal(301);`,
            ].join('\n'),
          },
        ],
      },
    ]);

    const { stats } = await runTests(testFilename, {
      requests: [
        {
          _id: 'req_123',
          url: '301.insomnia.rest',
          method: 'get',
        },
      ],
    });

    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);
  });
});

export async function generateToTmpFile(suites: Array<TestSuite>): Promise<string> {
  const p = path.join(os.tmpdir(), `${Math.random()}.test.js`);
  await generateToFile(p, suites);
  return p;
}
