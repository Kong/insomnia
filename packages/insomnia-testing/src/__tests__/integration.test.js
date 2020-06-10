// @flow
import axios from 'axios';
import { generateToTmpFile } from '../generate';
import { runTests } from '../run';

jest.mock('axios');

describe('integration', () => {
  it('generates and runs basic tests', async () => {
    const testFilename = await generateToTmpFile([
      {
        name: 'Example Suite',
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
        name: 'Example Suite',
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
            name: 'Tests sending a request',
            code: [
              `const resp = await insomnia.send({ url: '301.insomnia.rest' });`,
              `expect(resp.status).toBe(301);`,
            ].join('\n'),
          },
        ],
      },
    ]);

    const { stats } = await runTests(testFilename);

    expect(stats.tests).toBe(2);
    expect(stats.failures).toBe(0);
    expect(stats.passes).toBe(2);
  });
});
