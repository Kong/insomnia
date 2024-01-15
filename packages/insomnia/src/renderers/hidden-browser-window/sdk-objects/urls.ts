import queryString from 'query-string';

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

export class QueryParam extends Property {
    key: string;
    value: string;

    constructor(options: { key: string; value: string } | string) {
        super();

        if (typeof options === 'string') {
            try {
                const optionsObj = JSON.parse(options);
                // validate key and value fields
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
        // this may not always be executed in the browser
        return queryString.parse(queryStr);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static parseSingle(param: string, _idx?: number, _all?: string[]) {
        // it seems that _idx and _all are not useful
        return queryString.parse(param);

    }

    static unparse(params: object) {
        return Object.entries(params)
            .map(entry => `${entry[0]}=${entry[1] || ''}`)
            .join('&');
    }

    static unparseSingle(obj: { key: string; value: string }) {
        if ('key' in obj && 'value' in obj) {
            // TODO: validate and unescape
            return `${obj.key}=${obj.value}`;
        }
        return {};
    }

    toString() {
        return `${this.key}=${this.value}`; // validate key, value contains '='
    }

    update(param: string | { key: string; value: string }) {
        if (typeof param === 'string') {
            const paramObj = QueryParam.parse(param);
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

export interface UrlObject {
    auth: {
        username: string;
        password: string;
    } | undefined;
    hash: string;
    host: string[];
    path: string[];
    port: string;
    protocol: string;
    query: { key: string; value: string }[];
    variables: { key: string; value: string }[];
}

export class Url extends PropertyBase {
    _kind: string = 'Url';

    auth?: { username: string; password: string };
    hash?: string;
    host: string[];
    path?: string[];
    port?: string;
    protocol?: string;
    query: PropertyList<QueryParam>;
    variables: VariableList<Variable>;

    // TODO: user could pass anything
    constructor(
        def: {
            auth?: { username: string; password: string }; // TODO: should be related to RequestAuth
            hash?: string;
            host: string[];
            path?: string[];
            port?: string;
            protocol: string;
            query: PropertyList<QueryParam>;
            variables: VariableList<Variable>;
        } | string
    ) {
        super({});

        if (typeof def === 'string') {
            const urlObj = Url.parse(def);

            if (urlObj) {
                this.auth = urlObj.auth;
                this.hash = urlObj.hash;
                this.host = urlObj.host;
                this.path = urlObj.path;
                this.port = urlObj.port;
                this.protocol = urlObj.protocol;

                const queryList = urlObj.query ? urlObj.query.map(kvObj => new QueryParam(kvObj)) : [];
                this.query = new PropertyList<QueryParam>(queryList);
                const varList = urlObj.variables ?
                    urlObj.variables
                        .map((kvObj: { key: string; value: string }) => new Variable(kvObj)) :
                    [];
                this.variables = new VariableList(undefined, varList);
            } else {
                throw Error(`url is invalid: ${def}`); // TODO:
            }
        } else {
            this.auth = def.auth ? { username: def.auth.username, password: def.auth.password } : undefined;
            this.hash = def.hash ? def.hash : '';
            this.host = def.host;
            this.path = def.path ? def.path : [];
            this.port = def.port ? def.port : '';
            this.protocol = def.protocol ? def.protocol : '';
            this.query = def.query ? def.query : new PropertyList<QueryParam>([]);
            this.variables = def.variables ? def.variables : new VariableList(undefined, new Array<Variable>());
        }
    }

    static isUrl(obj: object) {
        return '_kind' in obj && obj._kind === 'Url';
    }

    static parse(urlStr: string): UrlObject | undefined {
        // TODO: URL requires explicit requiring in Node.js
        if (!URL.canParse(urlStr)) {
            console.error(`invalid URL string ${urlStr}`);
            return undefined;
        }

        const url = new URL(urlStr);
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
        return this.host.join('/');
    }

    getPath(unresolved?: boolean) {
        const path = this.path ? this.path.join('/') : '';

        if (unresolved) {
            return '/' + path;
        }
        // TODO: handle variables
        return path;
    }

    getPathWithQuery() {
        const path = this.path ? this.path.join('/') : '';
        const pathHasPrefix = path.startsWith('/') ? path : '/' + path;

        const query = this.query
            .map(param => `${param.key}=${param.value}`, {})
            .join('&');

        return `${pathHasPrefix}?${query}`;
    }

    getQueryString() {
        return this.query
            .map(queryParam => (`${queryParam.key}=${queryParam.key}`), {})
            .join('&');
    }

    // TODO:
    getRemote(forcePort?: boolean) {
        const host = this.host.join('/');
        if (forcePort) {
            const port = this.protocol && (this.protocol === 'https:') ? 443 : 80; // TODO: support ws, gql, grpc
            return `${host}:${port}`;
        }
        return this.port ? `${host}:${this.port}` : `${host}`;
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
        const queryStr = this.query
            .map(param => `${param.key}=${param.value}`, {})
            .join('&');

        const auth = this.auth ? `${this.auth.username}:${this.auth.password}@` : '';
        if (forceProtocol) {
            return `${this.protocol}//${auth}${this.host}:${this.port}${this.path}?${queryStr}#${this.hash}`; // TODO: improve auth
        }
        return `${auth}${this.host}:${this.port}${this.path}?${queryStr}#${this.hash}`;
    }

    update(url: string | object) {
        // user could pass anything in script

        if (typeof url === 'string') {
            const urlObj = Url.parse(url);
            if (urlObj) {
                this.auth = urlObj.auth ? {
                    username: urlObj.auth.username,
                    password: urlObj.auth.password,
                } : {
                    username: '',
                    password: '',
                };
                this.hash = urlObj.hash ? urlObj.hash : '';
                this.host = urlObj.host ? urlObj.host : [];
                this.path = urlObj.path ? urlObj.path : [];
                this.port = urlObj.port ? urlObj.port : '';
                this.protocol = urlObj.protocol ? urlObj.protocol : '';
                this.query = urlObj.query ?
                    new PropertyList(urlObj.query.map(kv => new QueryParam(kv))) :
                    new PropertyList<QueryParam>([]);
                // TODO: update variables
                // this.variables = new VariableList(undefined, new Array<Variable>());
            } else {
                throw Error(`failed to parse url: ${url}`);
            }
        } else {
            if ('auth' in url && typeof url.auth === 'object' && url.auth) {
                if ('username' in url.auth
                    && typeof url.auth.username === 'string'
                    && 'password' in url.auth
                    && typeof url.auth.password === 'string'
                ) {
                    this.auth = { username: url.auth.username, password: url.auth.password };
                } else {
                    console.error('the auth field must have "username" and "password" fields');
                }
            }

            if ('hash' in url && typeof url.hash === 'string') {
                this.hash = url.hash;
            } else {
                this.hash = '';
            }

            if ('host' in url && Array.isArray(url.host)) {
                const isStringArray = url.host.length > 0 ? typeof url.host[0] === 'string' : true;
                if (isStringArray) {
                    this.host = url.host;
                } else {
                    console.error('type of "host" is invalid');
                }
            } else {
                this.host = [];
            }

            if ('path' in url && Array.isArray(url.path)) {
                const isStringArray = url.path.length > 0 ? typeof url.path[0] === 'string' : true;
                if (isStringArray) {
                    this.path = url.path;
                } else {
                    console.error('type of "path" is invalid');
                }
            } else {
                this.path = [];
            }

            this.port = 'port' in url && url.port && typeof url.port === 'string' ? url.port : '';
            this.protocol = 'protocol' in url && url.protocol && typeof url.protocol === 'string' ? url.protocol : '';

            if ('query' in url && Array.isArray(url.query)) {
                const queryParams = url.query
                    .filter(obj => 'key' in obj && 'value' in obj)
                    .map(kv => new QueryParam(kv));

                this.query = new PropertyList(queryParams);
            }

            // TODO: update variables
            // this.variables = new VariableList(undefined, new Array<Variable>());
        }
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
        this.host = patternObj.host.join('/');
        this.path = patternObj.path.join('/');
        this.port = patternObj.port;
    }

    static parseAndValidate(pattern: string): {
        scheme: 'http:' | 'https:' | '*' | 'file:';
        host: string[];
        path: string[];
        port: string;
    } {
        // TODO: validate the pattern
        const urlObj = Url.parse(pattern);

        if (!urlObj || urlObj.host.length === 0) {
            throw Error(`match pattern (${pattern}) is invalid and failed to parse`);
        }

        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:' && urlObj.protocol !== '*' && urlObj.protocol !== 'file:') {
            throw Error(`scheme (${urlObj.protocol}) is invalid and failed to parse`);
        }

        return { scheme: urlObj.protocol, host: urlObj.host, path: urlObj.path, port: `${urlObj.port}` };
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
            && this.testPort(urlObj.port, urlObj.protocol)
            && this.testPath(urlObj.path.join('/'));
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
