import type { Cookie as InsomniaCookie, CookieJar as InsomniaCookieJar } from 'insomnia/src/models/cookie-jar';
import { Cookie as ToughCookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

import { Property, PropertyList } from './properties';

export interface InsomniaCookieExtensions {
    creation?: Date;
    creationIndex?: number;
    lastAccessed?: Date;
    pathIsDefault?: boolean;
};

export interface CookieOptions extends InsomniaCookieExtensions {
    id?: string;
    key: string;
    value: string;
    expires?: Date | string | null;
    maxAge?: number | 'Infinity' | '-Infinity';
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    hostOnly?: boolean;
    session?: boolean;
    extensions?: { key: string; value: string }[];
}

export class Cookie extends Property {
    override readonly _kind: string = 'Cookie';
    protected cookie: ToughCookie;
    private extensions?: { key: string; value: string }[];
    private insoExtensions: InsomniaCookieExtensions = {};

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

        this.id = cookieDef.id || '';
        this.cookie = cookie;
        this.insoExtensions = {
            creation: cookieDef.creation,
            creationIndex: cookieDef.creationIndex,
            lastAccessed: cookieDef.lastAccessed,
            pathIsDefault: cookieDef.pathIsDefault,
        };
    }

    static override _index = 'key';

    static isCookie(obj: Property) {
        return '_kind' in obj && obj._kind === 'Cookie';
    }

    static parse(cookieStr: string) {
        const cookieObj = ToughCookie.parse(cookieStr, { loose: true });
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
            maxAge: cookieObj.maxAge,
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

    override toString = () => {
        const hostOnlyPart = this.cookie.hostOnly ? '; HostOnly' : '';
        const sessionPart = this.cookie.extensions?.includes('session') ? '; Session' : '';
        const extensionPart = this.extensions && this.extensions.length > 0 ?
            '; ' + this.extensions.map(ext => `${ext.key}=${ext.value}`).join(';') :
            '';

        return this.cookie.toString() + hostOnlyPart + sessionPart + extensionPart;
    };

    override valueOf = () => {
        return this.cookie.toJSON().value;
    };

    get key() {
        return this.cookie.toJSON().key;
    };

    override toJSON = () => {
        return {
            id: this.id,
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
            // extra fields from Insomnia
            creation: this.insoExtensions.creation,
            creationIndex: this.insoExtensions.creationIndex,
            lastAccessed: this.insoExtensions.lastAccessed,
            pathIsDefault: this.insoExtensions.pathIsDefault,
        };
    };
}

export class CookieList extends PropertyList<Cookie> {
    override _kind: string = 'CookieList';

    constructor(cookies: Cookie[]) {
        super(
            Cookie,
            undefined,
            cookies,
        );
    }

    static isCookieList(obj: object) {
        return '_kind' in obj && obj._kind === 'CookieList';
    }
}

export class CookieObject extends CookieList {
    private cookieJar: CookieJar;

    constructor(cookieJar: InsomniaCookieJar | null) {
        const cookies = cookieJar
            ? cookieJar.cookies.map((cookie: InsomniaCookie): Cookie => {
                let expires: string | Date | null = null;
                if (cookie.expires || cookie.expires === 0) {
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
                    // follows are properties from Insomnia
                    creation: cookie.creation,
                    creationIndex: cookie.creationIndex,
                    lastAccessed: cookie.lastAccessed,
                    pathIsDefault: cookie.pathIsDefault,
                });
            })
            : [];

        super(cookies);
        const scriptCookieJar = cookieJar ? new CookieJar(cookieJar.name, cookies) : new CookieJar('', []);
        this.cookieJar = scriptCookieJar;
        this.typeClass = Cookie;
    }

    jar() {
        return this.cookieJar;
    }
}

export class CookieJar {
    // CookieJar from tough-cookie can not be used, as it will failed in comparing context location and cookies' domain
    // as it reads location from the browser window, it is "localhost"
    private jar: Map<string, Map<string, Cookie>>; // Map<domain, Map<cookieKey, cookieObject>>
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
                this.jar.set(properties.domain, domainCookies.set(properties.key, cookie));
            });
        }
    }

    set(url: string, key: string, value: string | CookieOptions, cb: (error?: Error, cookie?: Cookie) => void) {
        const domainCookies = this.jar.get(url) || new Map();
        if (typeof value === 'string') {
            const domainCookie = new Cookie({
                key: key,
                value: value,
                domain: url,
            });
            this.jar.set(url, domainCookies.set(key, domainCookie));
            cb(undefined, domainCookie);
        } else {
            const domainCookie = new Cookie(value);
            this.jar.set(url, domainCookies.set(key, domainCookie));
            cb(undefined, domainCookie);
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
        cb(undefined, domainCookies.get(name));
    }

    getAll(url: string, cb: (error?: Error, cookies?: Cookie[]) => void) {
        const domainCookies = this.jar.get(url) || new Map();
        cb(
            undefined,
            Array.from(domainCookies.values()),
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
            .forEach((domainCookies: Map<string, Cookie>) => {
                Array.from(domainCookies.values()).forEach(cookie => {
                    const cookieObj = cookie.toJSON();
                    cookies.push({
                        id: cookieObj.id,
                        key: cookieObj.key,
                        value: cookieObj.value,
                        expires: cookieObj.expires || 'Infinity', // transform it back to 'Infinity', avoid edge cases
                        domain: cookieObj.domain || undefined,
                        path: cookieObj.path || undefined,
                        secure: cookieObj.secure,
                        httpOnly: cookieObj.httpOnly,
                        extensions: cookieObj.extensions || undefined,
                        creation: cookieObj.creation,
                        creationIndex: cookieObj.creationIndex,
                        hostOnly: cookieObj.hostOnly || undefined,
                        pathIsDefault: cookieObj.pathIsDefault,
                        lastAccessed: cookieObj.lastAccessed,
                    });
                });
            });

        return {
            name: this.jarName,
            cookies,
        };
    }
}

export function mergeCookieJar(
    originalCookieJar: InsomniaCookieJar,
    updatedCookieJar: { name: string; cookies: Partial<InsomniaCookie>[] },
): InsomniaCookieJar {
    const cookiesWithId = updatedCookieJar.cookies.map((cookie): InsomniaCookie => {
        if (!cookie.id) {
            // this follows the generation approach in the `cookie-list.tsx`
            cookie.id = uuidv4();
        }
        return cookie as InsomniaCookie;
    });

    return {
        ...originalCookieJar,
        cookies: cookiesWithId,
    };
}
