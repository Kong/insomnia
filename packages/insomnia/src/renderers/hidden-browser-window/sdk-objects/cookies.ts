import { Cookie as ToughCookie } from 'tough-cookie';

import { Property, PropertyList } from './base';

export interface CookieOptions {
    key: string;
    value: string;
    expires?: Date | string;
    maxAge?: string | 'Infinity' | '-Infinity';
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    hostOnly?: boolean;
    session?: boolean;
    extensions?: { key: string; value: string }[];
}

export class Cookie extends Property {
    readonly _kind: string = 'Cookie';
    private cookie: ToughCookie;
    private extensions?: { key: string; value: string }[];

    constructor(cookieDef: CookieOptions | string) {
        super();

        if (typeof cookieDef === 'string') {
            const cookieDefParsed = Cookie.parse(cookieDef);
            if (!cookieDefParsed) {
                throw Error('failed to parse cookie, the cookie string seems invalid');
            }
            cookieDef = cookieDefParsed;
        }

        const def = { ...cookieDef };
        this.extensions = def.extensions ? [...def.extensions] : [];
        def.extensions = [];

        const cookie = ToughCookie.fromJSON(def);
        if (!cookie) {
            throw Error('failed to parse cookie, the cookie string seems invalid');
        }
        this.cookie = cookie;
    }

    static isCookie(obj: Property) {
        return '_kind' in obj && obj._kind === 'Cookie';
    }

    static parse(cookieStr: string) {
        const cookieObj = ToughCookie.parse(cookieStr);
        if (!cookieObj) {
            throw Error('failed to parse cookie, the cookie string seems invalid');
        }

        const hostOnly = cookieObj.extensions?.includes('HostOnly') || false;
        const session = cookieObj.extensions?.includes('Session') || false;
        if (hostOnly) {
            cookieObj.extensions = cookieObj.extensions?.filter(item => item !== 'HostOnly') || [];
        }
        if (session) {
            cookieObj.extensions = cookieObj.extensions?.filter(item => item !== 'Session') || [];
        }

        // Tough Cookies extensions works well with string[], but not {key: string; value: string}[]
        const extensions = cookieObj.extensions?.map((entry: string | { key: string; value: string }) => {
            if (typeof entry === 'string') {
                const equalPos = entry.indexOf('=');
                if (equalPos > 0) {
                    return { key: entry.slice(0, equalPos), value: entry.slice(equalPos + 1) };
                }
                return { key: entry, value: 'true' };
            } else if (
                'key' in entry &&
                'value' in entry &&
                typeof entry.key === 'string' &&
                typeof entry.value === 'string'
            ) {
                return { key: entry.key, value: entry.value };
            } else {
                throw Error('failed to create cookie, extension must be: { key: string; value: string }[]');
            }

        });

        return {
            key: cookieObj.key,
            value: cookieObj.value,
            expires: cookieObj.expires || undefined,
            maxAge: `${cookieObj.maxAge}` || undefined,
            domain: cookieObj.domain || undefined,
            path: cookieObj.path || undefined,
            secure: cookieObj.secure || false,
            httpOnly: cookieObj.httpOnly || false,
            hostOnly,
            session,
            extensions: extensions,
        };
    }

    static stringify(cookie: Cookie) {
        return cookie.toString();
    }

    static unparseSingle(cookieOpt: CookieOptions) {
        const cookie = new Cookie(cookieOpt);
        if (!cookie) {
            throw Error('failed to unparse cookie, the cookie options seems invalid');
        }
        return cookie.toString();
    }

    static unparse(cookies: Cookie[]) {
        const cookieStrs = cookies.map(cookie => cookie.toString());
        return cookieStrs.join('; ');
    }

    toString = () => {
        const hostOnlyPart = this.cookie.hostOnly ? '; HostOnly' : '';
        const sessionPart = this.cookie.extensions?.includes('session') ? '; Session' : '';
        const extensionPart = this.extensions && this.extensions.length > 0 ?
            '; ' + this.extensions.map(ext => `${ext.key}=${ext.value}`).join(';') :
            '';

        return this.cookie.toString() + hostOnlyPart + sessionPart + extensionPart;
    };

    valueOf = () => {
        return this.cookie.toJSON().value;
    };
}

export class CookieList extends PropertyList<Cookie> {
    _kind: string = 'CookieList';
    cookies: Cookie[];

    constructor(parent: CookieList | undefined, cookies: Cookie[]) {
        super(
            cookies
        );
        this._parent = parent;
        this.cookies = cookies;
    }

    static isCookieList(obj: object) {
        return '_kind' in obj && obj._kind === 'CookieList';
    }
}
