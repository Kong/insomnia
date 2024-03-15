import { Property, PropertyBase, PropertyList } from './properties';
import { Variable, VariableList } from './variables';

// TODO: make it also work with node.js
let UrlParser = URL;
let UrlSearchParams = URLSearchParams;
export function setUrlParser(provider: any) {
    UrlParser = provider;
}
export function setUrlSearchParams(provider: any) {
    UrlSearchParams = provider;
}

export interface QueryParamOptions {
    key: string;
    value: string;
}

export class QueryParam extends Property {
    _kind: string = 'QueryParam';

    key: string;
    value: string;

    constructor(options: { key: string; value: string } | string) {
        super();

        if (typeof options === 'string') {
            try {
                const optionsObj = JSON.parse(options);
                this.key = optionsObj.key;
                this.value = optionsObj.value;
            } catch (e) {
                throw Error(`invalid QueryParam options ${e}`);
            }
        } else if (typeof options === 'object' && ('key' in options) && ('value' in options)) {
            this.key = options.key;
            this.value = options.value;
        } else {
            throw Error('unknown options for new QueryParam');
        }
    }

    // TODO:
    // (static) _postman_propertyAllowsMultipleValues :Boolean
    // (static) _postman_propertyIndexKey :String

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

    toString() {
        const params = new UrlSearchParams();
        params.append(this.key, this.value);

        return params.toString();
    }

    update(param: string | { key: string; value: string }) {
        if (typeof param === 'string') {
            const paramObj = QueryParam.parseSingle(param);
            this.key = typeof paramObj.key === 'string' ? paramObj.key : '';
            this.value = typeof paramObj.value === 'string' ? paramObj.value : '';
        } else if ('key' in param && 'value' in param) {
            this.key = param.key;
            this.value = param.value;
        } else {
            throw Error('the param for update must be: string | { key: string; value: string }');
        }
    }
}

export interface UrlOptions {
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
    _kind: string = 'Url';

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
        if (typeof def === 'string') {
            def = def.includes('://') ? def : 'http://' + def;
        } else if (!def.protocol || def.protocol === '') {
            def.protocol = 'http://';
        }

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

    static isUrl(obj: object) {
        return '_kind' in obj && obj._kind === 'Url';
    }

    static parse(urlStr: string): UrlOptions | undefined {
        // TODO: enable validation
        // if (!UrlParser.canParse(urlStr)) {
        //     console.error(`invalid URL string ${urlStr}`);
        //     return undefined;
        // }

        const url = new UrlParser(urlStr);
        const query = Array.from(url.searchParams.entries())
            .map(kv => {
                const kvArray = kv as [string, string];
                return { key: kvArray[0], value: kvArray[1] };
            });

        return {
            auth: url.username !== '' ? { // TODO: make it compatible with RequestAuth
                username: url.username,
                password: url.password,
            } : undefined,
            hash: url.hash,
            host: url.hostname.split('/'),
            path: url.pathname.split('/'),
            port: url.port,
            protocol: url.protocol, // e.g. https:
            query,
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
        return this.host.join('.').toLowerCase();
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

        return params.toString();
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
                this.query.filter(queryParam => queryParam.key === params, {})
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
            console.error('failed to remove query params: unknown params type, only supports QueryParam[], string[] or string');
        }
    }

    toString(forceProtocol?: boolean) {
        const protocol = forceProtocol ?
            (this.protocol ? this.protocol : 'https:') :
            (this.protocol ? this.protocol : '');

        const parser = new UrlParser(`${protocol}//` + this.getHost());
        parser.username = this.auth?.username || '';
        parser.password = this.auth?.password || '';
        parser.port = this.port || '';
        parser.pathname = this.getPath();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        parser.search = this.getQueryString();
        parser.hash = this.hash || '';

        return parser.toString();
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

    private pattern: string;

    constructor(pattern: string) {
        super();

        this.pattern = pattern;
    }

    static readonly MATCH_ALL_URLS: string = '<all_urls>';
    static pattern: string | undefined = undefined; // TODO: its usage is unknown
    static readonly PROTOCOL_DELIMITER: string = '+';

    // TODO: the url can not start with -

    getProtocols(): string[] {
        const protocolEndPos = this.pattern.indexOf('://');
        if (protocolEndPos < 0) {
            throw Error('UrlMatchPattern: protocol is not specified');
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

    toString() {
        return this.pattern;
    }

    update(pattern: string) {
        this.pattern = pattern;
    }
}

export class UrlMatchPatternList<T extends UrlMatchPattern> extends PropertyList<T> {
    _kind: string = 'UrlMatchPatternList';

    constructor(parent: PropertyList<T> | undefined, populate: T[]) {
        super(UrlMatchPattern, undefined, populate);
        this.parent = parent;
    }

    static isUrlMatchPatternList(obj: any) {
        return '_kind' in obj && obj._kind === 'UrlMatchPatternList';
    }

    // TODO: unsupported yet
    // toObject(excludeDisabledopt, nullable, caseSensitiveopt, nullable, multiValueopt, nullable, sanitizeKeysopt) → {Object}

    test(urlStr: string) {
        return this
            .filter(matchPattern => matchPattern.test(urlStr), {})
            .length > 0;
    }
}
