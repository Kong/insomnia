import { getExistingConsole } from './console';
import { Property, PropertyBase, PropertyList } from './properties';
import { checkIfUrlIncludesTag } from './utils';

let UrlSearchParams = URLSearchParams;
export function setUrlSearchParams(provider: any) {
    UrlSearchParams = provider;
}

function canNotBeModifiedWarning(originalUrl: string | undefined) {
    getExistingConsole().warn(`The url "${originalUrl || 'undefined'}" can not be parsed, only 'insomnia.request.url.update(..)' will take effect.`);
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

    get auth(): { username: string; password: string } | undefined {
        // TODO: probably it should be related to the RequestAuth class
        // but the implementation seems only supporting username + password
        return this.urlObject && this.urlObject.username !== ''
            ? { username: this.urlObject.username, password: this.urlObject.password }
            : undefined;
    }
    get hash(): string {
        const fullHash = this.urlObject ? this.urlObject.hash : '';
        return fullHash.startsWith('#') ? fullHash.slice(1) : fullHash;
    }
    get host(): string[] {
        return this.urlObject ? this.urlObject.hostname.split('.') : [];
    }
    get path(): string[] {
        return this.urlObject ? this.urlObject.pathname.split('/').filter(segment => segment.trim() !== '') : [];
    }
    get port(): string {
        return this.urlObject ? this.urlObject.port : '';
    }
    get protocol(): string {
        return this.urlObject ? this.urlObject.protocol : '';
    }
    get query(): PropertyList<QueryParam> {
        const queryList = this.urlObject?.searchParams ?
            Array.from(this.urlObject.searchParams.entries())
                .map(queryEntry => new QueryParam({ key: queryEntry[0], value: queryEntry[1] }), {}) :
            [];
        return new PropertyList<QueryParam>(
                QueryParam,
                undefined,
                queryList
        );
    }
    get variables(): string[] {
        // TODO: it's usage is unknown
        return [];
    }

    private urlObject?: URL;
    private origin?: string;

    constructor(
        def: UrlOptions | string
    ) {
        super();
        this.initFields(def);
    }

    private initFields(urlOptions: UrlOptions | string | undefined) {
        if (typeof urlOptions === 'string') {
            // avoid escaping tags by the parser: {% uuid 'v4' %} -> %7B%%20uuid%20'v4'%20%%7D
            const ifUrlIncludesTag = checkIfUrlIncludesTag(urlOptions);
            if (URL.canParse(urlOptions) && !ifUrlIncludesTag) {
                this.urlObject = new URL(urlOptions);
            } else {
                this.urlObject = undefined;
            }
            this.origin = urlOptions;
        } else if (typeof urlOptions === 'object') {
            const protocolStr = (urlOptions.protocol || '').trim() ? urlOptions.protocol.trim() : 'https://';
            const authStr = urlOptions.auth ? `${urlOptions.auth.username}:${urlOptions.auth.password}@` : '';
            const hostStr = urlOptions.host.join('.');
            const portStr = urlOptions.port ? `:${urlOptions.port}` : '';
            const pathStr = urlOptions.path && urlOptions.path.length > 0 ? `/${urlOptions.path.filter(segment => segment.trim() !== '').join('/')}` : '';
            const queryStr = urlOptions.query && urlOptions.query.length > 0 ? '?' + urlOptions.query.map(pair => `${pair.key}=${pair.value}`).join('&') : '';
            const hashStr = urlOptions.hash ? `#${urlOptions.hash}` : '';

            const urlString = `${protocolStr}${authStr}${hostStr}${portStr}${pathStr}${queryStr}${hashStr}`;

            if (URL.canParse(urlString)) {
                this.urlObject = new URL(urlString);
            } else {
                this.urlObject = undefined;
            }
            this.origin = urlString;
        } else {
            throw Error(`url is invalid: ${urlOptions} `); // TODO:
        }
    }

    static _index: string = 'id';

    static isUrl(obj: object) {
        return '_kind' in obj && obj._kind === 'Url';
    }

    static parse(urlStr: string): UrlOptions | undefined {
        if (URL.canParse(urlStr)) {
            const urlObject = new URL(urlStr);
            const auth = urlObject.username === '' ? undefined : { username: urlObject.username, password: urlObject.password };
            const query = Array.from(urlObject.searchParams.entries())
                .map(entry => ({ key: entry[0], value: entry[1] }));

            return {
                auth,
                protocol: urlObject.protocol,
                host: urlObject.hostname.split('.'),
                port: urlObject.port,
                path: urlObject.pathname.split('/'),
                query,
                hash: urlObject.hash,
                variables: [],
            };
        }

        return undefined;
    }

    addQueryParams(params: { key: string; value: string }[] | string) {
        if (this.urlObject !== undefined) {
            if (typeof params === 'string') {
                const searchParams = new UrlSearchParams(params);
                Array.from(searchParams.entries())
                    .forEach(pair => {
                        if (this.urlObject) {
                            this.urlObject.searchParams.append(pair[0], pair[1]);
                        }
                    });
            } else if (Array.isArray(params)) {
                params.forEach(pair => {
                    if (this.urlObject) {
                        this.urlObject.searchParams.append(pair.key, pair.value);
                    }
                });
            } else {
                throw Error(`addQueryParams: failed to add params: ${JSON.stringify(params)}`);
            }
        } else {
            canNotBeModifiedWarning(this.origin);
        }
    }

    getHost() {
        if (this.urlObject) {
            return this.urlObject.hostname;
        }
        return '';
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getPath(_unresolved?: boolean) {
        if (this.urlObject) {
            return this.urlObject.pathname;
        }
        return '';
    }

    getPathWithQuery() {
        if (this.getPath(true).trim() === '') {
            return this.getQueryString();
        }
        return `${this.getPath(true)}?${this.getQueryString()}`;
    }

    getQueryString() {
        if (this.urlObject) {
            return this.urlObject.search.replace('?', '');
        }
        return '';
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getRemote(_forcePort?: boolean) {
        if (this.urlObject) {
            return this.urlObject.host;
        }
        return '';
    }

    removeQueryParams(params: QueryParam[] | string[] | string) {
        if (this.urlObject) {
            if (typeof params === 'string') {
                if (this.urlObject) {
                    this.urlObject.searchParams.delete(params);
                }
            } else if (Array.isArray(params)) {
                params.forEach((pair: QueryParam | string) => {
                    if (this.urlObject) {
                        if (typeof pair === 'string') {
                            this.urlObject.searchParams.delete(pair);
                        } else {
                            this.urlObject.searchParams.delete(pair.key, pair.value);
                        }
                    }
                });
            } else {
                throw Error('removeQueryParams: failed to remove query params: unknown params type, only supports QueryParam[], string[] or string');
            }
        } else {
            canNotBeModifiedWarning(this.origin);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    override toString(_forceProtocol?: boolean) {
        if (this.urlObject) {
            const urlInString = this.urlObject.toString();
            if (this.urlObject.pathname === '/' && urlInString === this.origin + '/') {
                // try to avoid replacing empty path with '/'
                return urlInString.slice(0, urlInString.length - 1);
            }
            return urlInString;
        }
        return this.origin || '';
    }

    update(url: UrlOptions | string) {
        this.initFields(url);
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
