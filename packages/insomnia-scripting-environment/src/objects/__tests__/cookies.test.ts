import { describe, expect, it } from 'vitest';

import { Cookie, CookieJar, CookieList, CookieObject, mergeCookieJar } from '../cookies';

describe('test Cookie object', () => {
    it('test basic operations', () => {
        const cookieStr1 = 'key=value; Domain=inso.com; Path=/; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Max-Age=0;Secure;HttpOnly;HostOnly;Session';

        expect(
            Cookie.parse(cookieStr1)
        ).toEqual({
            key: 'key',
            value: 'value',
            domain: 'inso.com',
            expires: new Date('2015-10-21T07:28:00.000Z'),
            maxAge: 0,
            path: '/',
            secure: true,
            httpOnly: true,
            hostOnly: true,
            session: true,
            extensions: [],
        });

        const cookie1Opt = {
            key: 'myCookie',
            value: 'myCookie',
            expires: '01 Jan 1970 00:00:01 GMT',
            maxAge: 7,
            domain: 'domain.com',
            path: '/',
            secure: true,
            httpOnly: true,
            hostOnly: true,
            session: true,
            extensions: [{ key: 'Ext', value: 'ExtValue' }],
        };
        const cookie1 = new Cookie(cookie1Opt);

        const expectedCookieString = 'myCookie=myCookie; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=7; Path=/; Secure; HttpOnly; HostOnly; Ext=ExtValue';

        expect(cookie1.toString()).toEqual(expectedCookieString);
        expect(Cookie.stringify(cookie1)).toEqual(expectedCookieString);

        const cookie2 = new Cookie(expectedCookieString);
        expect(cookie2.toString()).toEqual(expectedCookieString);
        expect(Cookie.stringify(cookie2)).toEqual(expectedCookieString);

        const c1 = new Cookie({
            key: 'c1',
            value: 'c1',
            maxAge: 1,
        });
        const c2 = new Cookie({
            key: 'c2',
            value: 'c2',
            maxAge: 2,
        });
        const CookieListStr = Cookie.unparse([c1, c2]);
        expect(CookieListStr).toEqual(
            'c1=c1; Max-Age=1; c2=c2; Max-Age=2'
        );

        expect(
            Cookie.unparseSingle(cookie1Opt)
        ).toEqual(expectedCookieString);

        const malformedCookieString = '=gingerale';
        expect(
            Cookie.parse(malformedCookieString)
        ).toEqual({
            key: '',
            value: 'gingerale',
            expires: 'Infinity',
            hostOnly: false,
            httpOnly: false,
            maxAge: null,
            secure: false,
            session: false,
        });
    });

    it('test cookie transforming', () => {
        const fakeBaseModel = {
            _id: '',
            type: '',
            parentId: '',
            modified: 0,
            created: 0,
            isPrivate: false,
            name: '',
        };
        const cookieJars = [
            {
                cookies: [
                    {
                        id: '1',
                        key: 'c1',
                        value: 'v1',
                        expires: 'Infinity',
                        domain: 'inso.com',
                        path: '/',
                        secure: true,
                        httpOnly: true,
                        extensions: [],
                        creation: new Date(),
                        creationIndex: 0,
                        hostOnly: true,
                        pathIsDefault: true,
                        lastAccessed: new Date(),
                    },
                    {
                        id: '2',
                        key: 'c2',
                        value: 'v2',
                        expires: new Date('08 Aug 1988 08:08:08 GMT'),
                        domain: 'inso.com',
                        path: '/',
                        secure: true,
                        httpOnly: true,
                        extensions: [],
                        creation: new Date(),
                        creationIndex: 0,
                        hostOnly: true,
                        pathIsDefault: true,
                        lastAccessed: new Date(),
                    },
                ],
            },
        ];

        cookieJars.forEach(jar => {
            const originalJar = { ...fakeBaseModel, ...jar };
            const sdkJar = new CookieObject(originalJar);
            const convertedJar = mergeCookieJar(originalJar, sdkJar.jar().toInsomniaCookieJar());

            expect(convertedJar).toEqual(originalJar);
        });
    });
});

describe('test CookieJar', () => {
    it('basic operations', () => {
        const cookieOptBase = {
            key: 'myCookie',
            value: 'myCookie',
            expires: '01 Jan 1970 00:00:01 GMT',
            maxAge: 7,
            domain: 'domain.com',
            path: '/',
            secure: true,
            httpOnly: true,
            hostOnly: true,
            session: true,
            extensions: [{ key: 'Ext', value: 'ExtValue' }],
        };

        const jar = new CookieJar(
            'my jar',
            [
                new Cookie({ ...cookieOptBase, key: 'c1', value: 'c1' }),
                new Cookie({ ...cookieOptBase, key: 'c2', value: 'c2' }),
            ],
        );

        jar.set('domain.com', 'c1', { ...cookieOptBase, key: 'c1', value: 'c1Updated' }, (error, cookie) => {
            expect(error).toBeUndefined();
            expect(cookie?.toJSON()).toEqual(
                new Cookie({ ...cookieOptBase, key: 'c1', value: 'c1Updated' }).toJSON()
            );
        });

        jar.set('domain2.com', 'c2', { ...cookieOptBase, key: 'c2', value: 'c2' }, (error, cookie) => {
            expect(error).toBeUndefined();
            expect(cookie?.toJSON()).toEqual(
                new Cookie({ ...cookieOptBase, key: 'c2', value: 'c2' }).toJSON()
            );
        });

        jar.get('domain.com', 'c1', (err, cookie) => {
            expect(err).toBeUndefined();
            expect(
                cookie?.toJSON(),
            ).toEqual(
                new Cookie({ ...cookieOptBase, key: 'c1', value: 'c1Updated' }).toJSON(),
            );
        });

        jar.get('domain2.com', 'c2', (err, cookie) => {
            expect(err).toBeUndefined();
            expect(
                cookie?.toJSON(),
            ).toEqual(
                new Cookie({ ...cookieOptBase, key: 'c2', value: 'c2' }).toJSON(),
            );
        });

        jar.unset('domain.com', 'c1', err => {
            expect(err).toBeUndefined();
        });

        jar.get('domain.com', 'c1', (err, cookie) => {
            expect(err).toBeUndefined();
            expect(cookie).toBeUndefined();
        });

        jar.clear('domain2.com', err => {
            expect(err).toBeUndefined();
        });

        jar.get('domain2.com', 'c2', (err, cookie) => {
            expect(err).toBeUndefined();
            expect(cookie).toBeUndefined();
        });
    });

    it('CookieList operations', () => {
        const cookieList = new CookieList(
            [
                new Cookie({ key: 'c1', value: 'v1' }),
                new Cookie({ key: 'c2', value: 'v2' }),
            ]
        );

        const upsertedC1 = new Cookie({ key: 'c1', value: 'v1upserted' });
        cookieList.upsert(upsertedC1);
        expect(cookieList.one('c1')).toEqual(upsertedC1);
    });
});
