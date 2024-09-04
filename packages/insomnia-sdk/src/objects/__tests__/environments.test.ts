import { validate } from 'uuid';
import { describe, expect, it } from 'vitest';

import { Environment, Variables } from '../environments';

describe('test Variables object', () => {
    it('test basic operations', () => {
        const variables = new Variables({
            globalVars: new Environment('globals', { value: '777' }),
            environmentVars: new Environment('environments', {}),
            collectionVars: new Environment('baseEnvironment', {}),
            iterationDataVars: new Environment('iterationData', {}),
        });

        const uuidAnd777 = variables.replaceIn('{{    $randomUUID }}{{value  }}');
        expect(validate(uuidAnd777.replace('777', ''))).toBeTruthy();

        const uuidAndBrackets1 = variables.replaceIn('{{    $randomUUID }}}}');
        expect(validate(uuidAndBrackets1.replace('}}', ''))).toBeTruthy();

        const uuidAndBrackets2 = variables.replaceIn('}}{{    $randomUUID }}');
        expect(validate(uuidAndBrackets2.replace('}}', ''))).toBeTruthy();
    });

    it('test environment override', () => {
        const globalOnlyVariables = new Variables({
            globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
            environmentVars: new Environment('environments', {}),
            collectionVars: new Environment('baseEnvironment', {}),
            iterationDataVars: new Environment('iterationData', {}),
        });
        const normalVariables = new Variables({
            globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
            environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
            collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
            iterationDataVars: new Environment('iterationData', {}),
        });
        const variablesWithIterationData = new Variables({
            globalVars: new Environment('globals', { scope: 'global', value: 'global-value' }),
            environmentVars: new Environment('environments', { scope: 'subEnv', value: 'subEnv-value' }),
            collectionVars: new Environment('baseEnvironment', { scope: 'baseEnv', value: 'baseEnv-value' }),
            iterationDataVars: new Environment('iterationData', { scope: 'iterationData', value: 'iterationData-value' }),
        });

        expect(globalOnlyVariables.get('value')).toEqual('global-value');
        expect(normalVariables.get('value')).toEqual('subEnv-value');
        expect(variablesWithIterationData.get('value')).toEqual('iterationData-value');
    });
});
