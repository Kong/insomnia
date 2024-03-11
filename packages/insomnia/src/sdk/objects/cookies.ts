import { Cookie as ToughCookie } from 'tough-cookie';

import { Cookie as InsomniaCookie, CookieJar as InsomniaCookieJar } from '../../../src/models/cookie-jar';
import { Property, PropertyList } from './properties';

export interface CookieOptions {
    id?: string;
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
    protected cookie: ToughCookie;
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

    key = () => {
        return this.cookie.toJSON().key;
    };

    toJSON = () => {
        return {
            key: this.cookie.key,
            value: this.cookie.value,
            expires: this.cookie.expires === 'Infinity' ? undefined : this.cookie.expires,
            maxAge: this.cookie.maxAge,
            domain: this.cookie.domain,
            path: this.cookie.path,
            secure: this.cookie.secure,
            httpOnly: this.cookie.httpOnly,
            hostOnly: this.cookie.hostOnly,
            session: this.cookie.extensions?.includes('session'),
            extensions: this.extensions,
        };
    };
}

class CookieWrapper extends Cookie {
    constructor(options: CookieOptions) {
        super(options);
    }

    originalCookie = () => {
        return this.cookie;
    };
}

export class CookieList extends PropertyList<Cookie> {
    _kind: string = 'CookieList';

    constructor(parent: CookieList | undefined, cookies: Cookie[]) {
        super(
            Cookie,
            undefined,
            cookies
        );
        this.parent = parent;
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
                    id: cookie.id,
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

function fromToughCookie(toughCookie: ToughCookie): Cookie {
    let expires: string | Date = '';
    if (toughCookie.expires) {
        if (typeof toughCookie.expires === 'number') {
            expires = new Date(toughCookie.expires);
        } else {
            expires = toughCookie.expires;
        }
    }
    let maxAge: string | undefined = undefined;
    if (typeof toughCookie.maxAge === 'number') {
        maxAge = `${toughCookie.maxAge}`;
    }

    return new Cookie({
        key: toughCookie.key,
        value: toughCookie.value,
        expires: expires,
        maxAge: maxAge,
        domain: toughCookie.domain || undefined,
        path: toughCookie.path || undefined,
        secure: toughCookie.secure,
        httpOnly: toughCookie.httpOnly,
        hostOnly: toughCookie.hostOnly || undefined,
        session: undefined, // not supported in Insomnia
        extensions: undefined, // TODO
    });
}

export class CookieJar {
    // CookieJar from tough-cookie can not be used, as it will failed in comparing context location and cookies' domain
    // as it reads location from the browser window, it is "localhost"
    private jar: Map<string, Map<string, ToughCookie>>; // domain -> <key -> cookie>
    private jarName: string;

    constructor(jarName: string, cookies?: Cookie[]) {
        this.jarName = jarName;
        this.jar = new Map();

        if (cookies) {
            cookies.forEach(cookie => {
                const properties = cookie.toJSON();
                if (!properties.domain) {
                    throw Error(`domain is not specified for the cookie ${cookie.key}`);
                }

                const domainCookies = this.jar.get(properties.domain) || new Map();
                const domainCookie = new ToughCookie({
                    key: properties.key,
                    value: properties.value,
                    expires: properties.expires,
                    maxAge: properties.maxAge,
                    domain: properties.domain,
                    path: properties.path || undefined,
                    secure: properties.secure,
                    httpOnly: properties.httpOnly,
                    extensions: properties.extensions ?
                        properties.extensions.map(ext => `${encodeURIComponent(ext.key)}=${encodeURIComponent(ext.key)}`) :
                        [],
                    creation: undefined, // it is not supported in Cookie
                });

                this.jar.set(properties.domain, domainCookies.set(properties.key, domainCookie));
            });
        }
    }

    set(url: string, key: string, value: string | CookieOptions, cb: (error?: Error, cookie?: Cookie) => void) {
        const domainCookies = this.jar.get(url) || new Map();
        if (typeof value === 'string') {
            const domainCookie = new ToughCookie({
                key: key,
                value: value,
                domain: url,
                creation: new Date(),
                expires: new Date(Date.now() + 1000 * 3600 * 24 * 30),
            });
            this.jar.set(url, domainCookies.set(key, domainCookie));
            cb(undefined, new Cookie({
                key: key,
                value: value,
                domain: url,
            }));
        } else {
            const domainCookie = new CookieWrapper(value);
            this.jar.set(url, domainCookies.set(key, domainCookie.originalCookie()));
            cb(undefined, domainCookie); // TODO:
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
        const domainCookies = this.jar.get(url) || new Map();
        const toughCookie = domainCookies.get(name);
        cb(undefined, toughCookie ? fromToughCookie(toughCookie) : undefined);
    }

    getAll(url: string, cb: (error?: Error, cookies?: Cookie[]) => void) {
        const domainCookies = this.jar.get(url) || new Map();
        cb(
            undefined,
            Array.from(domainCookies.values())
                .map((cookie: ToughCookie) => fromToughCookie(cookie)),
        );
    }

    unset(url: string, name: string, cb: (error?: Error | null) => void) {
        const domainCookies = this.jar.get(url);
        if (!domainCookies) {
            cb(undefined);
        } else {
            domainCookies.delete(name);
            cb(undefined);
        }
    }

    clear(url: string, cb: (error?: Error | null) => void) {
        this.jar.delete(url);
        cb(undefined);
    }

    toInsomniaCookieJar() {
        const cookies = new Array<Partial<InsomniaCookie>>();
        Array.from(this.jar.values())
            .forEach((domainCookies: Map<string, ToughCookie>) => {
                Array.from(domainCookies.values()).forEach(cookie => {
                    cookies.push({
                        key: cookie.key,
                        value: cookie.value,
                        expires: cookie.expires,
                        domain: cookie.domain || undefined,
                        path: cookie.path || undefined,
                        secure: cookie.secure,
                        httpOnly: cookie.httpOnly,
                        extensions: cookie.extensions || undefined,
                        creation: cookie.creation || undefined,
                        creationIndex: cookie.creationIndex,
                        hostOnly: cookie.hostOnly || undefined,
                        pathIsDefault: cookie.pathIsDefault || undefined,
                        lastAccessed: cookie.lastAccessed || undefined,
                    });
                });
            });

        return {
            name: this.jarName,
            cookies,
        };
    }
}
