import { describe, expect, it } from 'vitest';

import { translateHandlersInScript } from '../postman';

describe('test translateHandlersInScript', () => {
    [
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
    ].forEach(testCase => {
        it(`translate: ${testCase.script}`, () => {
            expect(translateHandlersInScript(testCase.script)).toBe(testCase.expected);
        });
    });
});
