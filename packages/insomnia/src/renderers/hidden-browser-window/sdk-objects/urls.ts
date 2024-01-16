import { Property, PropertyBase, PropertyList } from './base';
import { Variable, VariableList } from './variables';

// export class QueryParam extends Property {
//     key: string = '';
//     value: string = '';

//     constructor(options: {
//         id?: string;
//         name?: string;
//         key: string;
//         value: string;
//     }) {
//         super();

//         this.id = options.id ? options.id : '';
//         this.name = options.name ? options.name : '';
//         this.key = options.key;
//         this.value = options.value;
//     }

//     // TODO: improve following fields
//     static _postman_propertyAllowsMultipleValues: boolean = true;
//     static _postman_propertyIndexKey: string = 'formData';

//     // parse a form data string into an array of objects, where each object contains a key and a value.
//     static parse(query: string): { key: string; value: string }[] {
//         try {
//             const keyValues = JSON.parse(query);
//             return keyValues.filter((keyValue: object) => {
//                 if (!('key' in keyValue) || !('value' in keyValue)) {
//                     console.error('ignored some formdata as "key" or "value" is not found in it');
//                     return false;
//                 }
//                 return true;
//             });
//         } catch (e) {
//             console.error(`failed to parse QueryParams: ${e.message}`);
//             return [];
//         }
//     }

//     valueOf() {
//         return this.value;
//     }
// }

let urlParser = URL;
let UrlSearchParams = URLSearchParams;
export function setUrlParser(provider: any) {
    urlParser = provider;
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

// export interface UrlOptions {
//     auth?: { username: string; password: string };
//     hash?: string;
//     host: string[];
//     path?: string[];
//     port?: string;
//     protocol: string;
//     query: PropertyList<QueryParam>;
//     variables: VariableList<Variable>; // TODO: basically it is not supported now
// }

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
    query: PropertyList<QueryParam> = new PropertyList<QueryParam>([]);
    variables: VariableList<Variable> = new VariableList<Variable>(undefined, []);

    constructor(
        def: UrlOptions | string
    ) {
        super({});
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
            this.query = new PropertyList<QueryParam>(queryList);

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
        if (!urlParser.canParse(urlStr)) {
            console.error(`invalid URL string ${urlStr}`);
            return undefined;
        }

        const url = new urlParser(urlStr);
        const query = Array.from(url.searchParams.entries())
            .map((kv: [string, string]) => {
                return { key: kv[0], value: kv[1] };
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

        const parser = new urlParser(`${protocol}//` + this.getHost());
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

// UrlMatchPattern implements chrome extension match patterns:
// https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
export class UrlMatchPattern extends Property {
    // scheme
    scheme: 'http:' | 'https:' | '*' | 'file:';
    // host
    // About wildcard:
    // If you use a wildcard in the host pattern
    // it must be the first or only character, and it must be followed by a period (.) or forward slash (/).
    host: string;
    // path:
    // Must contain at least a forward slash
    // The slash by itself matches any path.
    path: string;

    private port: string;

    // Special cases: https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns#special
    // "<all_urls>"
    // "file:///"
    // "http://localhost/*"
    // It doesn't support match patterns for top Level domains (TLD).

    constructor(pattern: string) {
        super();

        const patternObj = UrlMatchPattern.parseAndValidate(pattern);
        this.scheme = patternObj.scheme;
        this.host = patternObj.host;
        this.path = patternObj.path;
        this.port = patternObj.port;
    }

    static parseAndValidate(pattern: string): {
        scheme: 'http:' | 'https:' | '*' | 'file:';
        host: string;
        path: string;
        port: string;
    } {
        // TODO: validate the pattern
        const urlObj = new Url(pattern);

        if (!urlObj || urlObj.host.length === 0) {
            throw Error(`match pattern (${pattern}) is invalid and failed to parse`);
        }

        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:' && urlObj.protocol !== '*' && urlObj.protocol !== 'file:') {
            throw Error(`scheme (${urlObj.protocol}) is invalid and failed to parse`);
        }

        return {
            scheme: urlObj.protocol,
            host: urlObj.getHost(),
            path: urlObj.getPath() || '/',
            port: urlObj.port || '',
        };
    }

    static readonly MATCH_ALL_URLS: string = '<all_urls>';
    static pattern: string | undefined = undefined; // TODO: its usage is unknown
    static readonly PROTOCOL_DELIMITER: string = '+';

    // TODO: the url can not start with -
    private readonly starRegPattern = '[a-zA-Z0-9\-]*';

    getProtocols(): string[] {
        switch (this.scheme) {
            case 'http:':
                return ['http'];
            case 'https:':
                return ['https'];
            case '*':
                return ['http', 'https'];
            case 'file:':
                return ['file'];
            default:
                throw `invalid scheme ${this.scheme}`;
        }
    }

    test(urlStr: string) {
        const urlObj = Url.parse(urlStr);
        if (!urlObj) {
            return false;
        }

        return this.testProtocol(urlObj.protocol)
            && this.testHost(urlObj.host.join('/'))
            && this.testPort(urlObj.port || '', urlObj.protocol)
            && urlObj?.path && this.testPath(urlObj.path.join('/'));
    }

    testHost(host: string) {
        const hostRegPattern = new RegExp(this.host.replace('*', this.starRegPattern), 'ig');
        return hostRegPattern.test(host);
    }

    testPath(path: string) {
        const pathRegPattern = new RegExp(this.path.replace('*', this.starRegPattern), 'ig');
        return pathRegPattern.test(path);
    }

    // TODO: it is confused to verify both port and protocol
    // testPort verifies both port and protocol, but not the relationship between them
    testPort(port: string, protocol: string) {
        if (!this.testProtocol(protocol)) {
            return false;
        }

        const portRegPattern = new RegExp(this.port.replace('*', this.starRegPattern), 'ig');
        if (!portRegPattern.test(port)) {
            return false;
        }

        return true;
    }

    testProtocol(protocol: string) {
        switch (protocol) {
            case 'http:':
                return this.scheme === 'http:' || this.scheme === '*';
            case 'https:':
                return this.scheme === 'https:' || this.scheme === '*';
            case '*':
                return this.scheme === 'http:' || this.scheme === 'https:' || this.scheme === '*';
            case 'file:':
                return this.scheme === 'file:';
            default:
                throw `invalid scheme ${protocol}`;
        }
    }

    toString() {
        return `${this.scheme}//${this.host}${this.path}`;
    }

    update(pattern: string) {
        const patternObj = UrlMatchPattern.parseAndValidate(pattern);
        this.scheme = patternObj.scheme;
        this.host = patternObj.host.join('/');
        this.path = patternObj.path.join('/');
        this.port = patternObj.port;
    }
}

export class UrlMatchPatternList<T extends UrlMatchPattern> extends PropertyList<T> {
    _kind: string = 'UrlMatchPatternList';

    constructor(parent: PropertyList<T> | undefined, populate: T[]) {
        super(populate);
        this._parent = parent;
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
