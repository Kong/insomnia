import { describe, expect, it } from 'vitest';

import { translateHandlersInScript } from '../postman';

describe('test translateHandlersInScript', () => {
  [
    // pm. -> insomnia.
    {
      script: "pm.environment.set('', '')",
      expected: "insomnia.environment.set('', '')",
    },
    {
      script: 'ipm.fn()',
      expected: 'ipm.fn()',
    },
    {
      script: 'h5pm.fn()',
      expected: 'h5pm.fn()',
    },
    {
      script: '$pm.fn()',
      expected: '$pm.fn()',
    },
    {
      script: '_pm.fn()',
      expected: '_pm.fn()',
    },
    {
      script: 'call(pm.environment.get("hehe"))',
      expected: 'call(insomnia.environment.get("hehe"))',
    },
    {
      script: `
                console.log(pm.variables.get('score'), pm.variables.get('score2'));
                console.log(pm.collectionVariables.get('score'));
                console.log(pm.environment.get('score'));`,
      expected: `
                console.log(insomnia.variables.get('score'), insomnia.variables.get('score2'));
                console.log(insomnia.collectionVariables.get('score'));
                console.log(insomnia.environment.get('score'));`,
    },
    // responseBody
    {
      script: 'responseBody',
      expected: 'insomnia.response.body',
    },
    {
      script: 'log(responseBody)',
      expected: 'log(insomnia.response.body)',
    },
    {
      script: '$responseBody',
      expected: '$responseBody',
    },
    {
      script: 'foo.responseBody',
      expected: 'foo.responseBody',
    },
    {
      script: 'responseBody$foo',
      expected: 'responseBody$foo',
    },
    // responseCode.code
    {
      script: 'responseCode.code',
      expected: 'insomnia.response.code',
    },
    {
      script: 'log(responseCode.code)',
      expected: 'log(insomnia.response.code)',
    },
    {
      script: '$responseCode.code',
      expected: '$responseCode.code',
    },
    {
      script: 'foo.responseCode.code',
      expected: 'foo.responseCode.code',
    },
    {
      script: 'responseCode.code$foo',
      expected: 'responseCode.code$foo',
    },
  ].forEach(testCase => {
    it(`translate: ${testCase.script}`, () => {
      expect(translateHandlersInScript(testCase.script)).toBe(testCase.expected);
    });
  });
});
