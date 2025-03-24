import { getExistingConsole } from './console';
import { Property, PropertyList } from './properties';
import { Url, UrlMatchPattern, UrlMatchPatternList } from './urls';

export interface ProxyConfigOptions {
    match: string;
    host: string;
    port?: number;
    tunnel: boolean;
    disabled?: boolean;
    authenticate: boolean;
    username: string;
    password: string;
    // follows are for compatibility with Insomnia
    bypass?: string[];
    protocol: string;
}

export class ProxyConfig extends Property {
    override _kind: string = 'ProxyConfig';
    type: string;

    host: string;
    match: string;
    port?: number;
    tunnel: boolean;
    authenticate: boolean;
    username: string;
    password: string;
    bypass: string[]; // it is for compatibility with Insomnia's bypass list
    protocol: string;

    static authenticate: boolean = false;
    static bypass: UrlMatchPatternList<UrlMatchPattern> = new UrlMatchPatternList<UrlMatchPattern>(undefined, []);
    static host: string = '';
    static match: string = '';
    static password: string = '';
    static port?: number = undefined;
    static tunnel: boolean = false; // unsupported
    static username: string = '';
    static protocol: string = 'https:';

    constructor(def: {
        id?: string;
        name?: string;
        type?: string;

        match: string;
        host: string;
        port?: number;
        tunnel: boolean;
        disabled?: boolean;
        authenticate: boolean;
        username: string;
        password: string;
        bypass?: string[];
        protocol: string;
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
        this.protocol = def.protocol;
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
        const portSegment = this.port === undefined ? '' : `:${this.port}`;

        if (this.authenticate) {
            return `${this.protocol}//${this.username}:${this.password}@${this.host}${portSegment}`;
        }
        return `${this.protocol}//${this.host}${portSegment}`;

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
        port?: number;
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updateProtocols(_protocols: string[]) {
        // In Insomnia there is no whitelist while there is a blacklist
        throw Error('updateProtocols is not supported in Insomnia');
    }
}

// example:
// myProxyConfigs = new ProxyConfigList({}, [
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
}

export function transformToSdkProxyOptions(
    httpProxy: string,
    httpsProxy: string,
    proxyEnabled: boolean,
    noProxy: string,
) {
    const bestProxy = httpsProxy || httpProxy || '';
    const enabledProxy = proxyEnabled && bestProxy.trim() !== '';
    const bypassProxyList = noProxy ?
        noProxy
            .split(',')
            .map(urlStr => urlStr.trim()) :
        [];
    const proxy: ProxyConfigOptions = {
        disabled: !enabledProxy,
        match: '<all_urls>',
        bypass: bypassProxyList,
        host: '',
        port: undefined,
        tunnel: false,
        authenticate: false,
        username: '',
        password: '',
        protocol: 'http',
    };

    if (bestProxy !== '') {
        let sanitizedProxy = bestProxy;
        if (bestProxy.indexOf('://') === -1) {
            getExistingConsole().warn(`The protocol is missing for proxy, 'https:' is enabled for: ${bestProxy}`);
            sanitizedProxy = 'https://' + bestProxy;
        }

        try {
            const sanitizedProxyUrlOptions = new URL(sanitizedProxy); // it should just work in node and browser

            if (sanitizedProxyUrlOptions.port !== '') {
                proxy.port = parseInt(sanitizedProxyUrlOptions.port, 10);
            }

            proxy.protocol = sanitizedProxyUrlOptions.protocol;
            proxy.host = sanitizedProxyUrlOptions.hostname;
            proxy.username = sanitizedProxyUrlOptions.username;
            proxy.password = sanitizedProxyUrlOptions.password;
            if (proxy.username || proxy.password) {
                proxy.authenticate = true;
            }
        } catch (e) {
            throw `Failed to parse proxy (${sanitizedProxy}): ${e.message}`;
        }
    }

    return proxy;
}
