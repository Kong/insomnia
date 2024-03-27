import { describe, expect, it } from '@jest/globals';

import { Property, PropertyBase, PropertyList } from '../properties';

describe('test Property objects', () => {

    it('PropertyBase: basic operations', () => {
        const pbase = new PropertyBase('my property');

        expect(pbase.toJSON()).toEqual({
            _kind: 'PropertyBase',
            description: 'my property',
        });
        expect(pbase.toObject()).toEqual({
            _kind: 'PropertyBase',
            description: 'my property',
        });
    });

    it('Property: basic operations', () => {
        const prop = new Property(
            'id',
            'name',
            false,
            { id: 'real_id', name: 'real_name' },
        );

        expect(prop.toJSON()).toEqual({
            _kind: 'Property',
            disabled: false,
            id: 'real_id',
            name: 'real_name',
        });
    });

    it('PropertyList: basic operations', () => {
        const propList = new PropertyList(
            {},
            undefined,
            [
                new Property('id1', 'p1'),
            ],
        );

        propList.add(new Property('id2', 'p2'));
        propList.append(new Property('id3', 'p3'));
        expect(propList.count()).toBe(3);
        expect(propList.all()).toEqual([
            {
                _kind: 'Property',
                disabled: false,
                id: 'id1',
                name: 'p1',
            },
            {
                _kind: 'Property',
                disabled: false,
                id: 'id2',
                name: 'p2',
            },
            {
                _kind: 'Property',
                disabled: false,
                id: 'id3',
                name: 'p3',
            },
        ]);

        propList.clear();
        propList.assimilate(
            [
                new Property('id1', 'p1'),
                new Property('id2', 'p2'),
            ],
            false,
        );
        expect(propList.count()).toBe(2);

        propList.each(
            prop => {
                expect(prop.name?.startsWith('p')).toBeTruthy();
            },
            {},
        );

        expect(
            propList.filter(
                prop => prop.name === 'p1',
                {},
            ).length
        ).toBe(1);

        expect(
            propList.find(
                prop => prop?.name === 'p2',
                {},
            ) != null
        ).toBeTruthy();

        expect(propList.one('id1'))
            .toEqual(new Property('id1', 'p1'));
        expect(propList.has(new Property('id1', 'p1')))
            .toBeTruthy();
        expect(propList.indexOf(new Property('id1', 'p1')) >= 0).toBeTruthy();
        propList.clear();

        propList.insert(new Property('id0', 'p0'), 0);
        propList.insertAfter(new Property('id1', 'p1'), 1);
        propList.prepend(new Property('id-1', 'p-1'));
        propList.populate([new Property('id2', 'p2')]);
        expect(
            propList.map(
                prop => prop.id,
                {},
            )
        ).toEqual([
            'id-1',
            'id0',
            'id1',
            'id2',
        ]);
        expect(
            propList.reduce(
                (acc, prop) => acc += prop.id,
                '',
                {},
            ),
        ).toEqual('id-1id0id1id2');

        propList.remove(
            prop => prop.id === 'id-1',
            {},
        );
        expect(
            propList.count(),
        ).toEqual(3);

        propList.repopulate([
            new Property('id1', 'p1'),
            new Property('id2', 'p2'),
        ]);

        expect(propList.toString()).toEqual(
            '[{"_kind":"Property","id":"id1","name":"p1","disabled":false}; {"_kind":"Property","id":"id2","name":"p2","disabled":false}]',
        );
    });
});
