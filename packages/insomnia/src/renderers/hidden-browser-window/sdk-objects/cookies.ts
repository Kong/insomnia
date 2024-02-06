import { Cookie as ToughCookie, CookieJar as ToughCookieJar } from 'tough-cookie';

import { Cookie as InsomniaCookie, CookieJar as InsomniaCookieJar } from '../../../../src/models/cookie-jar';
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

export class CookieObject extends CookieList {
    private cookieJar: CookieJar;

    constructor(parent: CookieList | undefined, cookieJar: InsomniaCookieJar | null) {
        const cookies = cookieJar
            ? cookieJar.cookies.map((cookie: InsomniaCookie): Cookie => {
                let expires: string | Date = '';
                if (cookie.expires) {
                    if (typeof cookie.expires === 'number') {
                        expires = new Date(cookie.expires);
                    } else {
                        expires = cookie.expires;
                    }
                }

                return new Cookie({
                    key: cookie.key,
                    value: cookie.value,
                    expires: expires,
                    maxAge: undefined, // not supported in Insomnia
                    domain: cookie.domain,
                    path: cookie.path,
                    secure: cookie.secure,
                    httpOnly: cookie.httpOnly,
                    hostOnly: cookie.hostOnly,
                    session: undefined, // not supported in Insomnia
                    extensions: undefined, // TODO: its format from Insomnia is unknown
                });
            })
            : [];
        const scriptCookieJar = cookieJar ? new CookieJar(cookieJar.name, cookies) : new CookieJar('', []);

        super(parent, cookies);
        this.cookieJar = scriptCookieJar;
    }

    jar() {
        return this.cookieJar;
    }
}

// TODO: current it only works for only 1 domain (url)
// until Insomnia supports a whitelist for accessing cookies from script
export class CookieJar {
    private jar: ToughCookieJar;
    private url: string;

    constructor(url: string, cookies?: Cookie[]) {
        this.jar = new ToughCookieJar();
        this.url = url;

        if (cookies) {
            cookies.forEach(cookie => {
                this.jar.setCookieSync(
                    new ToughCookie({ key: cookie.name, value: cookie.valueOf() }),
                    url,
                );
            });
        }
    }

    set(url: string, name: string, value: string, cb: (error?: Error, cookie?: Cookie) => void) {
        try {
            const cookie = new ToughCookie({ key: name, value });
            this.jar.setCookieSync(cookie, url);
            cb(undefined, new Cookie({ key: name, value }));
        } catch (e) {
            cb(e, undefined);
        }
    }

    // TODO: create a better method for setting cookie, or overload the above method
    // set(
    //     url: string,
    //     info: { name: string; value: string; httpOnly: boolean },
    //     cb: (error?: Error, cookie?: Cookie) => void,
    // ) {
    //     try {
    //         const cookie = new ToughCookie({ key: info.name, value: info.value, httpOnly: info.httpOnly });
    //         this.jar.setCookieSync(cookie, url, { http: info.httpOnly });
    //         cb(undefined, new Cookie({ key: info.name, value: info.value, httpOnly: info.httpOnly }));
    //     } catch (e) {
    //         cb(e, undefined);
    //     }
    // }

    get(url: string, name: string, cb: (error?: Error, cookie?: Cookie) => void) {
        const cookie = this.jar.getCookiesSync(url)
            .find((cookie: ToughCookie) => {
                return cookie.key === name;
            });

        cb(
            undefined,
            cookie ? new Cookie({ key: cookie?.key, value: cookie.value }) : undefined
        );
    }

    getAll(url: string, cb: (error?: Error, cookies?: Cookie[]) => void) {
        const cookies = this.jar.getCookiesSync(url)
            .map((cookie: ToughCookie) => {
                return new Cookie({ key: cookie?.key, value: cookie.value });
            });

        cb(undefined, cookies);
    }

    unset(url: string, name: string, cb: (error?: Error | null) => void) {
        url = url.indexOf('://') < 0 ? 'http://' + url : url;
        const urlObj = new URL(url);

        this.jar.store.removeCookie(
            urlObj.host,
            urlObj.pathname,
            name,
            cb,
        );
    }

    clear(url: string, cb: (error?: Error | null) => void) {
        url = url.indexOf('://') < 0 ? 'http://' + url : url;
        const urlObj = new URL(url);

        this.jar.store.removeCookies(
            urlObj.host,
            urlObj.pathname,
            cb,
        );
    }

    toInsomniaCookieJar() {
        return new Promise((resolve, reject) => {
            this.jar.getCookies(this.url, (err, cookies) => {
                if (err) {
                    reject(err);
                }

                resolve({
                    name: this.url,
                    cookies,
                });
            });
        });
    }
}
