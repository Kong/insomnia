import { describe, expect, it } from 'vitest';

import { Header, HeaderList } from '../headers';
// import { QueryParam, setUrlParser, Url, UrlMatchPattern } from '../urls';

describe('test Header object', () => {
    it('test basic operations', () => {
        // const header = new Header('Content-Type: application/json\nUser-Agent: MyClientLibrary/2.0\n');
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

    it('HeaderList operations', () => {
        const headerList = new HeaderList(
            undefined,
            [
                new Header({ key: 'h1', value: 'v1' }),
                new Header({ key: 'h2', value: 'v2' }),
            ]
        );

        const upserted = new Header({ key: 'h1', value: 'v1upserted' });
        headerList.upsert(upserted);
        expect(headerList.one('h1')).toEqual(upserted);
    });
});
