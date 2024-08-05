import { describe, expect, it } from 'vitest';

import { Property, PropertyBase, PropertyList } from '../properties';

describe('test Property objects', () => {

    it('PropertyBase: basic operations', () => {
        const pbase = new PropertyBase('my property');

        expect(pbase.toJSON()).toEqual({
            description: 'my property',
        });
        expect(pbase.toObject()).toEqual({
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
            disabled: false,
            id: 'real_id',
            name: 'real_name',
        });

        expect(Property.replaceSubstitutions('{{ hehe }}', { hehe: 777 })).toEqual('777');
        expect(Property.replaceSubstitutionsIn(
            {
                value: '{{ hehe }}',
            },
            { hehe: 777 },
        ))
            .toEqual({ value: '777' });
    });

    it('PropertyList: basic operations: add, append, count, all, clear', () => {
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
                disabled: false,
                id: 'id1',
                name: 'p1',
            },
            {
                disabled: false,
                id: 'id2',
                name: 'p2',
            },
            {
                disabled: false,
                id: 'id3',
                name: 'p3',
            },
        ]);

        propList.clear();
    });

    it('PropertyList: basic operations: assimilate, each, filter, find', () => {
        const propList = new PropertyList<Property>(
            Property,
            undefined,
            [],
        );

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
    });

    it('PropertyList: basic operations: one, has, indexOf, insert, insertAfter, prepend, populate, map, reduce', () => {
        const propList = new PropertyList<Property>(
            Property,
            undefined,
            [
                new Property('id1', 'p1'),
                new Property('id2', 'p2'),
            ],
        );

        expect(propList.one('id1'))
            .toEqual(new Property('id1', 'p1'));
        expect(propList.has(new Property('id1', 'p1')))
            .toBeTruthy();
        expect(propList.indexOf(new Property('id1', 'p1')) === 0).toBeTruthy();
        propList.clear();

        propList.insert(new Property('id0', 'p0'), 0);
        propList.insertAfter(new Property('id1', 'p1'), 1);
        propList.prepend(new Property('id-1', 'p-1'));
        propList.populate([new Property('id2', 'p2')]);
    });

    it('PropertyList: basic operations: one, has, indexOf, insert, insertAfter, prepend, populate, map, reduce', () => {
        const propList = new PropertyList<Property>(
            Property,
            undefined,
            [
                new Property('id0', 'p0'),
                new Property('id1', 'p1'),
                new Property('id2', 'p2'),
            ],
        );

        expect(
            propList.map(
                prop => prop.id,
                {},
            )
        ).toEqual([
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
        ).toEqual('id0id1id2');
    });

    it('PropertyList: basic operations: remove, count, repopulate, toString, get, one, idx, upsert', () => {
        const propList = new PropertyList<Property>(
            Property,
            undefined,
            [
                new Property('id0', 'p0'),
                new Property('id1', 'p1'),
                new Property('id2', 'p2'),
            ],
        );

        propList.remove(
            prop => prop.id === 'id0',
            {},
        );
        expect(
            propList.count(),
        ).toEqual(2);

        propList.repopulate([
            new Property('id1', 'p1'),
            new Property('id2', 'p2'),
        ]);

        expect(propList.toString()).toEqual(
            '[{"id":"id1","name":"p1","disabled":false}; {"id":"id2","name":"p2","disabled":false}]',
        );

        const expectedP1 = new Property('id1', 'p1');
        const getP1 = propList.get('id1');
        const oneP1 = propList.one('id1');
        expect(getP1).toEqual(expectedP1);
        expect(oneP1).toEqual(expectedP1);

        const idxP1 = propList.idx(0);
        expect(idxP1).toEqual(expectedP1);

        const upsertedP2 = new Property('id2', 'upsertedP2');
        propList.upsert(upsertedP2);
        expect(propList.one('id2')).toEqual(upsertedP2);
    });
});
