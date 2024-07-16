import { Property, PropertyList } from './properties';
import { Url, UrlMatchPattern, UrlMatchPatternList } from './urls';

export interface ProxyConfigOptions {
    match: string;
    host: string;
    port: number;
    tunnel: boolean;
    disabled?: boolean;
    authenticate: boolean;
    username: string;
    password: string;
    bypass?: string[];
}

export class ProxyConfig extends Property {
    override _kind: string = 'ProxyConfig';
    type: string;

    host: string;
    match: string;
    port: number;
    tunnel: boolean;
    authenticate: boolean;
    username: string;
    password: string;
    bypass: string[]; // it is for compatibility with Insomnia's bypass list

    static authenticate: boolean = false;
    static bypass: UrlMatchPatternList<UrlMatchPattern> = new UrlMatchPatternList<UrlMatchPattern>(undefined, []);
    static host: string = '';
    static match: string = '';
    static password: string = '';
    static port: number = 0;
    static tunnel: boolean = false; // unsupported
    static username: string = '';

    constructor(def: {
        id?: string;
        name?: string;
        type?: string;

        match: string;
        host: string;
        port: number;
        tunnel: boolean;
        disabled?: boolean;
        authenticate: boolean;
        username: string;
        password: string;
        bypass?: string[];
    }) {
        super();

        this.id = def.id ? def.id : '';
        this.name = def.name ? def.name : '';
        this.type = def.type ? def.type : '';
        this.disabled = def.disabled ? def.disabled : false;

        this.host = def.host;
        this.match = def.match;
        this.port = def.port;
        this.tunnel = def.tunnel;
        this.authenticate = def.authenticate;
        this.username = def.username;
        this.password = def.password;
        this.bypass = def.bypass || [];
    }

    static override _index: string = 'key';

    static isProxyConfig(obj: object) {
        return '_kind' in obj && obj._kind === 'ProxyConfig';
    }

    getProtocols(): string[] {
        // match field example: 'http+https://example.com/*'
        const urlMatch = new UrlMatchPattern(this.match);
        return urlMatch.getProtocols();
    }

    getProxyUrl(): string {
        // http://proxy_username:proxy_password@proxy.com:8080
        // TODO: check if port is not given
        if (this.authenticate) {
            return `${this.username}:${this.password}@${this.host}:${this.port}`;
        }
        return `${this.host}:${this.port}`;
    }

    test(url?: string) {
        if (!url) {
            // TODO: it is confusing in which case url arg is optional
            return false;
        }
        if (this.bypass.includes(url)) {
            return false;
        }

        const urlMatch = new UrlMatchPattern(this.match);
        return urlMatch.test(url);
    }

    update(options: {
        host: string;
        match: string;
        port: number;
        tunnel: boolean;
        authenticate: boolean;
        username: string;
        password: string;
    }) {
        this.host = options.host;
        this.match = options.match;
        this.port = options.port;
        this.tunnel = options.tunnel;
        this.authenticate = options.authenticate;
        this.username = options.username;
        this.password = options.password;
    }

    updateProtocols(protocols: string[]) {
        const protoSeparator = this.match.indexOf('://');
        if (protoSeparator <= 0 || protoSeparator >= this.match.length) {
            throw Error('updateProtocols: invalid protocols, no protocol is detected');
        }

        this.match = protocols.join('+') + this.match.slice(protoSeparator);
    }
}

// myProxyConfig = new ProxyConfigList({}, [
//     {match: 'https://example.com/*', host: 'proxy.com', port: 8080, tunnel: true},
//     {match: 'http+https://example2.com/*', host: 'proxy2.com'},
// ]);

export class ProxyConfigList<T extends ProxyConfig> extends PropertyList<T> {
    constructor(parent: PropertyList<T> | undefined, populate: T[]) {
        super(
            ProxyConfig,
            undefined,
            populate
        );
        this.parent = parent;
    }

    static isProxyConfigList(obj: any) {
        return '_kind' in obj && obj._kind === 'ProxyConfigList';
    }

    resolve(url?: Url) {
        if (!url) {
            return null;
        }

        const urlStr = url.toString();
        const matches = this.list
            .filter((proxyConfig: ProxyConfig) => {
                return proxyConfig.test(urlStr);
            })
            .map(proxyConfig => proxyConfig.toJSON());

        if (matches.length > 0) {
            return matches[0];
        }
        return null;
    }

    // toObject(excludeDisabledopt, nullable, caseSensitiveopt, nullable, multiValueopt, nullable, sanitizeKeysopt) → {Object}
}
