import { describe, expect, it } from '@jest/globals';
import { validate } from 'uuid';

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
});
