import { describe, expect, it } from 'vitest';

import { Variable, VariableList } from '../variables';

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

    it('VariableList operations', () => {
        const varList = new VariableList(
            undefined,
            [
                new Variable({ key: 'h1', value: 'v1' }),
                new Variable({ key: 'h2', value: 'v2' }),
            ]
        );

        const upserted = new Variable({ key: 'h1', value: 'v1upserted' });
        varList.upsert(upserted);
        expect(varList.one('h1')).toEqual(upserted);
    });
});
