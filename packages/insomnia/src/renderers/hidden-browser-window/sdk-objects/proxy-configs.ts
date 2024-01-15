import { Property, PropertyList } from './base';

export interface ProxyConfigOptions {
    match: string;
    host: string;
    port: number;
    tunnel: boolean;
    disabled?: boolean;
    authenticate: boolean;
    username: string;
    password: string;
}

export class ProxyConfig extends Property {
    _kind: string = 'ProxyConfig';
    type: string;

    host: string;
    match: string;
    port: number;
    tunnel: boolean;
    authenticate: boolean;
    username: string;
    password: string;

    static authenticate: boolean;
    // static bypass: UrlMatchPatternList;
    static host: string;
    static match: string;
    static password: string;
    static port: number;
    static tunnel: boolean; // unsupported
    static username: string;

    static {
        ProxyConfig.authenticate = false;
        // ProxyConfig.bypass: UrlMatchPatternList;
        ProxyConfig.host = '';
        ProxyConfig.match = '';
        ProxyConfig.password = '';
        ProxyConfig.port = 0;
        ProxyConfig.tunnel = false;
        ProxyConfig.username = '';
    }

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
    }

    static isProxyConfig(obj: object) {
        return '_kind' in obj && obj._kind === 'ProxyConfig';
    }

    // TODO: should not read from match?
    getProtocols(): string[] {
        // match field example: 'http+https://example.com/*'
        const protoSeparator = this.match.indexOf('://');
        if (protoSeparator <= 0 || protoSeparator >= this.match.length) {
            return []; // invalid match value
        }

        return this.match
            .slice(0, protoSeparator)
            .split('+');
    }

    getProxyUrl(): string {
        const protos = this.getProtocols();
        // TODO: how to pick up a protocol?
        if (protos.length === 0) {
            return '';
        }

        // http://proxy_username:proxy_password@proxy.com:8080
        if (this.authenticate) {
            return `protos[0]://${this.username}:${this.password}@${this.host}:${this.port}`;
        }
        return `protos[0]://${this.host}:${this.port}`;
    }

    // TODO: unsupported yet
    // test(urlStropt)

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
            return; // invalid match value
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
        super(populate);
        this._parent = parent;
    }

    static isProxyConfigList(obj: any) {
        return '_kind' in obj && obj._kind === 'ProxyConfigList';
    }

    // TODO: need support URL at first
    // resolve(url?: URL) {
    //     return {
    //         host: string;
    //         match: string;
    //         port: number;
    //         tunnel: boolean;
    //         authenticate: boolean;
    //         username: string;
    //         password: string;
    //     }
    // }

    // toObject(excludeDisabledopt, nullable, caseSensitiveopt, nullable, multiValueopt, nullable, sanitizeKeysopt) → {Object}
}
