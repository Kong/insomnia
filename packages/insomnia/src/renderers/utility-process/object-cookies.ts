import { Property, PropertyList } from './object-base';

export interface CookieDef {
    key: string;
    value: string;
    expires?: Date | string;
    maxAge?: Number;
    domain?: string;
    path?: string;
    secure?: Boolean;
    httpOnly?: Boolean;
    hostOnly?: Boolean;
    session?: Boolean;
    extensions?: { key: string; value: string }[];
}

export class Cookie extends Property {
    private def: object;

    constructor(cookieDef: CookieDef | string) {
        super();
        this.kind = 'Cookie';
        this.description = 'Cookie';

        if (typeof cookieDef === 'string') {
            this.def = Cookie.parse(cookieDef);
        } else {
            this.def = cookieDef;
        }
    }

    static isCookie(obj: Property) {
        return obj.kind === 'Cookie';
    }

    static parse(cookieStr: string) {
        const parts = cookieStr.split(';');

        const def: CookieDef = { key: '', value: '' };
        const extensions: { key: string; value: string }[] = [];

        parts.forEach((part, i) => {
            const kvParts = part.split('=');
            const key = kvParts[0];

            if (i === 0) {
                const value = kvParts.length > 1 ? kvParts[1] : '';
                def.key, def.value = key, value;
            } else {
                switch (key) {
                    case 'Expires':
                        // TODO: it should be timestamp
                        const expireVal = kvParts.length > 1 ? kvParts[1] : '0';
                        def.expires = expireVal;
                        break;
                    case 'Max-Age':
                        let maxAgeVal = 0;
                        if (kvParts.length > 1) {
                            maxAgeVal = parseInt(kvParts[1], 10);
                        }
                        def.maxAge = maxAgeVal;
                        break;
                    case 'Domain':
                        const domainVal = kvParts.length > 1 ? kvParts[1] : '';
                        def.domain = domainVal;
                        break;
                    case 'Path':
                        const pathVal = kvParts.length > 1 ? kvParts[1] : '';
                        def.path = pathVal;
                        break;
                    case 'Secure':
                        def.secure = true;
                        break;
                    case 'HttpOnly':
                        def.httpOnly = true;
                        break;
                    case 'HostOnly':
                        def.hostOnly = true;
                        break;
                    case 'Session':
                        def.session = true;
                        break;
                    default:
                        const value = kvParts.length > 1 ? kvParts[1] : '';
                        extensions.push({ key, value });
                        def.extensions = extensions;
                }
            }
        });

        return def;
    }

    static stringify(cookie: Cookie) {
        return cookie.toString();
    }

    static unparseSingle(cookie: Cookie) {
        return cookie.toString();
    }

    // TODO: support PropertyList
    static unparse(cookies: Cookie[]) {
        const cookieStrs = cookies.map(cookie => cookie.toString());
        return cookieStrs.join(';');
    }

    toString = () => {
        // Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
        const cookieDef = this.def as CookieDef;
        const kvPair = `${cookieDef.key}=${cookieDef.value};`;
        const expires = cookieDef.expires ? `Expires=${cookieDef.expires?.toString()};` : '';
        const maxAge = cookieDef.maxAge ? `Max-Age=${cookieDef.maxAge};` : '';
        const domain = cookieDef.domain ? `Domain=${cookieDef.domain};` : '';
        const path = cookieDef.path ? `Path=${cookieDef.path};` : '';
        const secure = cookieDef.secure ? 'Secure;' : '';
        const httpOnly = cookieDef.httpOnly ? 'HttpOnly;' : '';
        // TODO: SameSite, Partitioned is not suported

        const hostOnly = cookieDef.hostOnly ? 'HostOnly;' : '';
        const session = cookieDef.session ? 'Session;' : '';

        // TODO: extension key may be conflict with pre-defined keys
        const extensions = cookieDef.extensions ?
            cookieDef.extensions
                .map((kv: { key: string; value: string }) => `${kv.key}=${kv.value}`)
                .join(';') : ''; // the last field doesn't have ';'

        return `${kvPair} ${expires} ${maxAge} ${domain} ${path} ${secure} ${httpOnly} ${hostOnly} ${session} ${extensions}`;
    };

    valueOf = () => {
        return (this.def as CookieDef).value;
    };
}

export class CookieList extends PropertyList<Cookie> {
    cookies: Cookie[];

    constructor(parent: object, cookies: Cookie[]) {
        super(Cookie, parent.toString(), cookies);
        this.cookies = cookies;
    }

    // (static) isCookieList(obj) → {Boolean}

}
