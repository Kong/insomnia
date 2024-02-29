import { describe, expect, it } from '@jest/globals';

import { Header } from '../headers';

describe('test Header object', () => {
    it('test basic operations', () => {
        const headerStr = 'Content-Type: application/json\nUser-Agent: MyClientLibrary/2.0\n';
        const headerObjs = [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'User-Agent', value: 'MyClientLibrary/2.0' },
        ];

        expect(Header.parse(headerStr)).toEqual(headerObjs);
        expect(
            Header.parse(Header.unparse(headerObjs))
        ).toEqual(headerObjs);
    });
});
