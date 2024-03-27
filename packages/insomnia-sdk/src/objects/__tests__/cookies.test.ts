import { describe, expect, it } from '@jest/globals';

import { Cookie } from '../cookies';

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
            maxAge: '0',
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
            maxAge: '7',
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
            maxAge: '1',
        });
        const c2 = new Cookie({
            key: 'c2',
            value: 'c2',
            maxAge: '2',
        });
        const CookieListStr = Cookie.unparse([c1, c2]);
        expect(CookieListStr).toEqual(
            'c1=c1; Max-Age=1; c2=c2; Max-Age=2'
        );

        expect(
            Cookie.unparseSingle(cookie1Opt)
        ).toEqual(expectedCookieString);
    });
});
