import { Property, PropertyBase, PropertyList } from './properties';
import { Variable, VariableList } from './variables';

let UrlSearchParams = URLSearchParams;
export function setUrlSearchParams(provider: any) {
    UrlSearchParams = provider;
}

export interface QueryParamOptions {
    key: string;
    value: string;
    type?: string;
    multiline?: string | boolean;
    disabled?: boolean;
    fileName?: string;
}

export class QueryParam extends Property {
    override _kind: string = 'QueryParam';

    key: string;
    value: string;
    type?: string;
    // the `multiline` and `fileName` are properties from Insomnia
    // they are added here to avoid being dropped
    multiline?: string | boolean;
    fileName?: string;

    constructor(options: QueryParamOptions | string) {
        super();

        if (typeof options === 'string') {
            try {
                const optionsObj = JSON.parse(options);
                this.key = optionsObj.key;
                this.value = optionsObj.value;
                this.type = optionsObj.type;
                this.multiline = optionsObj.multiline;
                this.disabled = optionsObj.disabled;
                this.fileName = optionsObj.fileName;
            } catch (e) {
                throw Error(`invalid QueryParam options ${e}`);
            }
        } else if (typeof options === 'object' && ('key' in options) && ('value' in options)) {
            this.key = options.key;
            this.value = options.value;
            this.type = options.type;
            this.multiline = options.multiline;
            this.disabled = options.disabled;
            this.fileName = options.fileName;
        } else {
            throw Error('unknown options for new QueryParam');
        }
    }

    // TODO:
    // (static) _postman_propertyAllowsMultipleValues :Boolean
    // (static) _postman_propertyIndexKey :String

    static override _index = 'key';

    static parse(queryStr: string) {
        const params = new UrlSearchParams(queryStr);
        return Array.from(params.entries())
            .map(entry => ({ key: entry[0], value: entry[1] }));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static parseSingle(paramStr: string, _idx?: number, _all?: string[]) {
        const pairs = QueryParam.parse(paramStr);
        if (pairs.length === 0) {
            throw Error('invalid search query string');
        }

        return pairs[0];
    }

    static unparse(params: QueryParamOptions[] | Record<string, string>) {
        const searchParams = new UrlSearchParams();

        if (Array.isArray(params)) {
            params.forEach((entry: QueryParamOptions) => searchParams.append(entry.key, entry.value));
        } else {
            Object.entries(params)
                .forEach(entry => searchParams.append(entry[0], entry[1]));
        }

        return searchParams.toString();
    }

    static unparseSingle(obj: { key: string; value: string }) {
        if ('key' in obj && 'value' in obj) {
            const params = new UrlSearchParams();
            params.append(obj.key, obj.value);

            return params.toString();
        }
        return {};
    }

    override toString() {
        const params = new UrlSearchParams();
        params.append(this.key, this.value);

        return params.toString();
    }

    update(param: string | { key: string; value: string; type?: string }) {
        if (typeof param === 'string') {
            const paramObj = QueryParam.parseSingle(param);
            if (!paramObj) {
                throw Error('failed to update param: input `param` is invalid');
            }
            this.key = typeof paramObj.key === 'string' ? paramObj.key : '';
            this.value = typeof paramObj.value === 'string' ? paramObj.value : '';
        } else if ('key' in param && 'value' in param) {
            this.key = param.key;
            this.value = param.value;
            this.type = param.type;
        } else {
            throw Error('the param for update must be: string | { key: string; value: string }');
        }
    }
}

export interface UrlOptions {
    id?: string;
    auth?: {
        username: string;
        password: string;
    };
    hash?: string;
    host: string[];
    path?: string[];
    port?: string;
    protocol: string;
    query: { key: string; value: string }[];
    variables: { key: string; value: string }[];
}

export class Url extends PropertyBase {
    override _kind: string = 'Url';

    id?: string;
    // TODO: should be related to RequestAuth
    // but the implementation seems only supports username + password
    auth?: { username: string; password: string };
    hash?: string;
    host: string[] = [];
    path?: string[] = [];
    port?: string;
    protocol?: string;
    query: PropertyList<QueryParam> = new PropertyList<QueryParam>(QueryParam, undefined, []);
    variables: VariableList<Variable> = new VariableList<Variable>(undefined, []);

    constructor(
        def: UrlOptions | string
    ) {
        super();
        this.setFields(def);
    }

    private setFields(def: UrlOptions | string) {
        const urlObj = typeof def === 'string' ? Url.parse(def) : def;

        if (urlObj) {
            this.auth = urlObj.auth;
            this.hash = urlObj.hash;
            this.host = urlObj.host;
            this.path = urlObj.path;
            this.port = urlObj.port;
            this.protocol = urlObj.protocol;

            const queryList = urlObj.query ?
                urlObj.query.map(kvObj => new QueryParam(kvObj), {}) :
                [];
            this.query = new PropertyList<QueryParam>(
                QueryParam,
                undefined,
                queryList
            );

            // TODO: variable is always empty in this way
            const varList = urlObj.variables ?
                urlObj.variables
                    .map(
                        (kvObj: { key: string; value: string }) => new Variable(kvObj),
                        {},
                    ) :
                [];

            this.variables = new VariableList(undefined, varList);

        } else {
            throw Error(`url is invalid: ${def}`); // TODO:
        }
    }

    static _index: string = 'id';

    static isUrl(obj: object) {
        return '_kind' in obj && obj._kind === 'Url';
    }

    static parse(urlStr: string): UrlOptions | undefined {
        // the URL API (for web) is not leveraged here because the input string could contain tags for interpolation
        // which will be encoded, then it would introduce confusion for users in manipulation
        // TODO: but it still would be better to rely on the URL API

        const endOfProto = urlStr.indexOf('://');
        const protocol = endOfProto >= 0 ? urlStr.slice(0, endOfProto + 1) : '';

        let auth: undefined | { username: string; password: string } = undefined;
        const potentialStartOfAuth = protocol === '' ? 0 : endOfProto + 3;
        let endOfAuth = urlStr.indexOf('@', potentialStartOfAuth);
        const startOfPathname = urlStr.indexOf('/', endOfProto >= 0 ? endOfProto + 3 : 0);
        const atCharIsBeforePath = endOfAuth < startOfPathname;
        if (atCharIsBeforePath) { // this checks if unencoded '@' appears in path
            if (endOfAuth >= 0 && potentialStartOfAuth < endOfAuth) { // e.g., '@insomnia.com' will be ignored
                const authStr = endOfAuth >= 0 ? urlStr.slice(potentialStartOfAuth, endOfAuth) : '';
                const authParts = authStr?.split(':');
                if (authParts.length < 2) {
                    throw Error(`new Url(): failed to parse auth in url ${urlStr}`);
                }
                // authParts[x] would not be undefined
                // add empty string for type checking
                const username = authParts[0] || '';
                const password = authParts[1] || '';
                auth = { username, password };
            }
        } else {
            // don't do anything if @ appears in path
            endOfAuth = -1;
        }

        const startOfHash = urlStr.indexOf('#');
        const hash = startOfHash >= 0 ? urlStr.slice(startOfHash + 1) : undefined;

        const endOfQuery = startOfHash >= 0 ? startOfHash : urlStr.length;
        const startOfQuery = urlStr.lastIndexOf('?', endOfQuery);
        const query = new Array<{ key: string; value: string }>();
        if (startOfQuery >= 0) {
            const queryStr = urlStr.slice(startOfQuery + 1, endOfQuery);
            query.push(
                ...queryStr
                    .split('&')
                    .map(pairStr => {
                        const queryParts = pairStr.split('=');
                        const key = queryParts[0] || '';
                        const value = queryParts.length > 1 ? queryParts[1] || '' : '';
                        return { key, value };
                    })
                    .filter(kvPair => {
                        return kvPair && kvPair.key !== ''; // the value could be ''
                    })
                    .map(kvPair => {
                        return { key: kvPair.key, value: kvPair.value };
                    }),
            );
        }

        const path = new Array<string>();
        if (startOfPathname >= 0) {
            let endOfPathname = urlStr.length;
            if (startOfQuery >= 0) {
                endOfPathname = startOfQuery;
            } else if (startOfHash >= 0) {
                endOfPathname = startOfHash;
            }
            const pathname = urlStr.slice(startOfPathname, endOfPathname);
            path.push(
                ...pathname.split('/'),
            );
        }

        let potentialStartOfHostname = 0;
        if (endOfAuth >= 0) {
            potentialStartOfHostname = endOfAuth + 1;
        } else if (endOfProto >= 0) {
            potentialStartOfHostname = endOfProto + 3;
        }
        let potentialEndOfHostname = urlStr.length;
        if (startOfPathname >= 0) {
            potentialEndOfHostname = startOfPathname;
        } else if (startOfQuery >= 0) {
            potentialEndOfHostname = startOfQuery;
        } else if (startOfHash >= 0) {
            potentialEndOfHostname = startOfHash;
        }
        const host = new Array<string>();
        let port = undefined;
        if (potentialStartOfHostname < potentialEndOfHostname) {
            const hostname = urlStr.slice(potentialStartOfHostname, potentialEndOfHostname);
            const hostnameParts = hostname.split(':');
            const hostPart = hostnameParts[0];
            if (hostnameParts.length === 2) {
                port = hostnameParts[1];
            } else if (hostnameParts.length > 2) {
                throw Error('new Url(): failed to parse hostname in url ${urlStr}');
            }
            if (!hostPart) {
                throw Error('new Url(): the hostname part is invalid');
            }

            host.push(
                ...
                hostPart.split('.'),
            );
        }

        return {
            auth,
            protocol,
            host,
            port,
            path,
            query,
            hash,
            variables: [],
        };
    }

    addQueryParams(params: { key: string; value: string }[] | string) {
        let queryParams: { key: string; value: string }[];

        if (typeof params === 'string') {
            queryParams = QueryParam.parse(params);
        } else {
            queryParams = params;
        }

        queryParams.forEach((param: { key: string; value: string }) => {
            this.query.append(new QueryParam({ key: param.key, value: param.value }));
        });
    }

    getHost() {
        return this.host.join('.');
    }

    getPath(unresolved?: boolean) {
        const pathStr = this.path ? this.path.join('/') : '/';
        const finalPath = pathStr.startsWith('/') ? pathStr : '/' + pathStr;

        if (unresolved) {
            return finalPath;
        }

        // TODO: should it support rendering variables here?
        return finalPath;
    }

    getPathWithQuery() {
        return `${this.getPath(true)}?${this.getQueryString()}`;
    }

    getQueryString() {
        const params = new UrlSearchParams();
        this.query.each(param => params.append(param.key, param.value), {});

        const queryParamStrs = this.query.map(pair => {
            return pair.value ? `${pair.key}=${pair.value}` : pair.key;
        }, {});

        return queryParamStrs.join('&');
    }

    getRemote(forcePort?: boolean) {
        const host = this.getHost();

        if (forcePort) {
            // TODO: it does not support GQL, gRPC and so on
            const port = this.port ? this.port :
                this.protocol && (this.protocol === 'https:') ? 443 : 80;
            return `${host}:${port}`;
        }

        // TODO: it does not support GQL, gRPC and so on
        const portWithColon = this.port ? `:${this.port}` : '';
        return `${host}${portWithColon}`;
    }

    removeQueryParams(params: QueryParam[] | string[] | string) {
        if (typeof params === 'string') {
            // it is a string
            this.query = new PropertyList(
                QueryParam,
                undefined,
                this.query.filter(queryParam => queryParam.key !== params, {})
            );
        } else if (params.length > 0) {
            let toBeRemoved: Set<string>;

            if (typeof params[0] === 'string') {
                // it is a string[]
                toBeRemoved = new Set(params as string[]);
            } else {
                // it is a QueryParam[]
                toBeRemoved = new Set(
                    (params as QueryParam[])
                        .map(param => param.key)
                );
            }

            this.query = new PropertyList(
                QueryParam,
                undefined,
                this.query.filter(queryParam => !toBeRemoved.has(queryParam.key), {})
            );
        } else {
            throw Error('failed to remove query params: unknown params type, only supports QueryParam[], string[] or string');
        }
    }

    override toString(forceProtocol?: boolean) {
        const protocolStr = forceProtocol ?
            (this.protocol ? `${this.protocol}//` : 'http://') :
            (this.protocol ? `${this.protocol}//` : '');

        const authStr = this.auth ? `${this.auth.username}:${this.auth.password}@` : '';
        const hostStr = this.getHost();
        const portStr = this.port ? `:${this.port}` : '';
        const pathStr = this.getPath();
        const queryStr = this.getQueryString() ? `?${this.getQueryString()}` : '';
        const hashStr = this.hash ? `#${this.hash}` : '';

        return `${protocolStr}${authStr}${hostStr}${portStr}${pathStr}${queryStr}${hashStr}`;
        // return parser.toString();
    }

    update(url: UrlOptions | string) {
        this.setFields(url);
    }
}

// interface Matcher {
//     match(pattern: string): boolean;
// }

// UrlMatchPattern implements chrome extension match patterns:
// https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
export class UrlMatchPattern extends Property {
    // scheme
    // scheme: 'http:' | 'https:' | '*' | 'file:';

    // host
    // About wildcard:
    // If you use a wildcard in the host pattern
    // it must be the first or only character, and it must be followed by a period (.) or forward slash (/).

    // path
    // Must contain at least a forward slash
    // The slash by itself matches any path.

    // Special cases: https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns#special
    // "<all_urls>"
    // "file:///"
    // "http://localhost/*"
    // It doesn't support match patterns for top Level domains (TLD).

    override id: string = '';
    private pattern: string;

    constructor(pattern: string) {
        super();

        this.pattern = pattern;
    }

    static override _index = 'id';
    static readonly MATCH_ALL_URLS: string = '<all_urls>';
    static pattern: string | undefined = undefined; // TODO: its usage is unknown
    static readonly PROTOCOL_DELIMITER: string = '+';

    // TODO: the url can not start with -

    getProtocols(): string[] {
        if (this.pattern === '<all_urls>') {
            return ['http', 'https', 'file'];
        }

        const protocolEndPos = this.pattern.indexOf('://');
        if (protocolEndPos < 0) {
            return [];
        }

        const protocolPattern = this.pattern.slice(0, protocolEndPos);
        const protocols = protocolPattern.split(UrlMatchPattern.PROTOCOL_DELIMITER);

        return protocols.map(protocol => protocol.replace(':', ''));
    }

    test(urlStr: string) {
        const protoEndPos = urlStr.indexOf(':');
        const protoStr = urlStr.slice(0, protoEndPos);
        const hostStr = this.getHost(urlStr);
        const pathStr = this.getPath(this.pattern);
        const portStr = this.getPort(urlStr);

        return this.testProtocol(protoStr) &&
            this.testHost(hostStr) &&
            this.testPath(pathStr) &&
            this.testPort(portStr, protoStr);
    }

    private getHost(urlStr: string) {
        const protocolEndPos = urlStr.indexOf('://') + 3;
        const hostBegPos = protocolEndPos;

        const portBegPos = urlStr.indexOf(':', protocolEndPos);
        const pathBegPos = urlStr.indexOf('/', protocolEndPos);
        const queryBegPos = urlStr.indexOf('?', protocolEndPos);
        const hashBegPos = urlStr.indexOf('?', protocolEndPos);

        let hostEndPos = urlStr.length;
        if (portBegPos >= 0) {
            hostEndPos = portBegPos;
        } else if (pathBegPos >= 0) {
            hostEndPos = pathBegPos;
        } else if (queryBegPos >= 0) {
            hostEndPos = queryBegPos;
        } else if (hashBegPos >= 0) {
            hostEndPos = hashBegPos;
        }

        return urlStr.slice(hostBegPos, hostEndPos);
    }

    testHost(hostStr: string) {
        const patternSegments = this.getHost(this.pattern).split('.');

        const inputHostSegments = hostStr.split('.');

        if (patternSegments.length !== inputHostSegments.length) {
            return false;
        }

        for (let i = 0; i < patternSegments.length; i++) {
            if (patternSegments[i] === '*') {
                continue;
            } else if (patternSegments[i] !== inputHostSegments[i]) {
                return false;
            }
        }
        return true;
    }

    private getPath(urlStr: string) {
        const protocolEndPos = urlStr.indexOf('://') + 3;
        const hostBegPos = protocolEndPos;
        const pathBegPos = urlStr.indexOf('/', hostBegPos);
        if (pathBegPos < 0) {
            return '';
        }

        const queryBegPos = urlStr.indexOf('?');
        const hashBegPos = urlStr.indexOf('#');
        let pathEndPos = urlStr.length;
        if (queryBegPos >= 0) {
            pathEndPos = queryBegPos;
        } else if (hashBegPos >= 0) {
            pathEndPos = hashBegPos;
        }

        return urlStr.slice(pathBegPos, pathEndPos);
    }

    testPath(pathStr: string) {
        const patternSegments = this.getPath(this.pattern).split('/');
        const inputSegments = pathStr.split('/');

        if (patternSegments.length !== inputSegments.length) {
            return false;
        }

        for (let i = 0; i < patternSegments.length; i++) {
            if (patternSegments[i] === '*') {
                continue;
            } else if (patternSegments[i] !== inputSegments[i]) {
                return false;
            }
        }
        return true;
    }

    private getPort(urlStr: string) {
        const protocolEndPos = urlStr.indexOf('/') + 2;
        const hostBegPos = protocolEndPos;

        let portBegPos = urlStr.indexOf(':', protocolEndPos);
        if (portBegPos <= 0) {
            return '';
        }
        portBegPos += 1; // the port is after ':'

        let portEndPos = urlStr.length;
        const pathBegPos = urlStr.indexOf('/', hostBegPos);
        const queryBegPos = urlStr.indexOf('?');
        const hashBegPos = urlStr.indexOf('#');

        if (pathBegPos >= 0) {
            portEndPos = pathBegPos;
        } else if (queryBegPos >= 0) {
            portEndPos = queryBegPos;
        } else if (hashBegPos >= 0) {
            portEndPos = hashBegPos;
        }

        return urlStr.slice(portBegPos, portEndPos);
    }

    testPort(port: string, protocol: string) {
        if (!this.testProtocol(protocol)) {
            return false;
        }

        const portPattern = this.getPort(this.pattern);
        if (portPattern === '*') {
            return true;
        } else if (portPattern === '' || port === '') {
            const protos = this.getProtocols();

            if (protocol === 'https') {
                return protos.includes('https') && (
                    (port === '443' && portPattern === '') ||
                    (port === '' && portPattern === '443') ||
                    (port === '' && portPattern === '')
                );
            } else if (protocol === 'http') {
                return protos.includes('http') && (
                    (port === '80' && portPattern === '') ||
                    (port === '' && portPattern === '80') ||
                    (port === '' && portPattern === '')
                );
            }
        }

        return portPattern === port;
    }

    testProtocol(protocol: string) {
        const protoPatterns = this.getProtocols();

        for (let i = 0; i < protoPatterns.length; i++) {
            if (protoPatterns[i] === '*') {
                return true;
            } else if (protoPatterns[i] === protocol) {
                return true;
            }
        }
        return false;
    }

    override toString() {
        return this.pattern;
    }

    update(pattern: string) {
        this.pattern = pattern;
    }
}

export class UrlMatchPatternList<T extends UrlMatchPattern> extends PropertyList<T> {
    override _kind: string = 'UrlMatchPatternList';

    constructor(parent: PropertyList<T> | undefined, populate: T[]) {
        super(UrlMatchPattern, undefined, populate);
        this.parent = parent;
    }

    static isUrlMatchPatternList(obj: any) {
        return '_kind' in obj && obj._kind === 'UrlMatchPatternList';
    }

    test(urlStr: string) {
        return this
            .filter(matchPattern => matchPattern.test(urlStr), {})
            .length > 0;
    }
}

export function toUrlObject(url: string | Url): Url {
    if (!url) {
        throw Error('Request URL is not specified');
    }
    return typeof url === 'string' ? new Url(url) : url;
}
