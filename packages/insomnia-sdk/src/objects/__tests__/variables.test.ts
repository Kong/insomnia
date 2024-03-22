import { describe, expect, it } from '@jest/globals';

import { Variable } from '../variables';

describe('test Variables object', () => {
    it('test basic operations', () => {

        const variable = new Variable({
            id: 'id',
            key: 'key',
            name: 'name',
            value: 'value',
            type: 'type',
            disabled: false,
        });

        expect(variable.get()).toBe('value');
        variable.set('value2');
        expect(variable.get()).toBe('value2');

    });
});
