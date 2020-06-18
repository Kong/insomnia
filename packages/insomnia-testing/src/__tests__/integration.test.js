// @flow
import axios from 'axios';
import type { TestSuite } from '../generate';
import { generateToFile } from '../generate';
import { runTests } from '../run';
import path from 'path';
import os from 'os';
import * as config from '../../webpack.config';

jest.mock('axios');

describe('webpack config', () => {
  it('should set mocha as external', () => {
    expect(config.externals.mocha).toBe('mocha');
  });
});

describe('integration', () => {
  it('generates and runs basic tests', async () => {
    const testFilename = await generateToTmpFile([
      {
        name: 'Example TestSuite',
        suites: [],
        tests: [
          {
            name: 'should return -1 when the value is not present',
            code: 'expect([1, 2, 3].indexOf(4)).toBe(-1);\nexpect(true).toBe(true);',
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
              `expect(resp.status).toBe(200);`,
              `expect(resp.headers['content-type']).toBe('application/json');`,
              `expect(resp.data.foo).toBe('bar');`,
            ].join('\n'),
          },
          {
            name: 'Tests referencing request by ID',
            code: [
              `const resp = await insomnia.send('req_123');`,
              `expect(resp.status).toBe(301);`,
            ].join('\n'),
          },
        ],
      },
    ]);

    const { stats } = await runTests(testFilename, {
      requests: {
        req_123: {
          url: '301.insomnia.rest',
          method: 'get',
        },
      },
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
