import { Property, PropertyBase, PropertyList } from './properties';
import { checkIfUrlIncludesTag } from './utils';

let UrlSearchParams = URLSearchParams;
export function setUrlSearchParams(provider: any) {
  UrlSearchParams = provider;
}

export interface QueryParamOptions {
  key: string;
  value?: string;
  type?: string;
  multiline?: string | boolean;
  disabled?: boolean;
  fileName?: string;
}

export class QueryParam extends Property {
  override _kind = 'QueryParam';

  key: string;
  value?: string;
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
        throw new Error(`invalid QueryParam options ${e}`);
      }
    } else if (typeof options === 'object' && 'key' in options && 'value' in options) {
      this.key = options.key;
      this.value = options.value;
      this.type = options.type;
      this.multiline = options.multiline;
      this.disabled = options.disabled;
      this.fileName = options.fileName;
    } else {
      throw new Error('unknown options for new QueryParam');
    }
  }

  // TODO:
  // (static) _postman_propertyAllowsMultipleValues :Boolean
  // (static) _postman_propertyIndexKey :String

  static override _index = 'key';

  static parse(queryStr: string) {
    const params = new UrlSearchParams(queryStr);
    return Array.from(params.entries()).map(entry => ({ key: entry[0], value: entry[1] }));
  }

  static parseSingle(paramStr: string, _idx?: number, _all?: string[]) {
    const pairs = QueryParam.parse(paramStr);
    if (pairs.length === 0) {
      throw new Error('invalid search query string');
    }

    return pairs[0];
  }

  static unparse(params: QueryParamOptions[] | Record<string, string>) {
    const searchParams = new UrlSearchParams();

    if (Array.isArray(params)) {
      params.forEach((entry: QueryParamOptions) => searchParams.append(entry.key, entry.value || ''));
    } else {
      Object.entries(params).forEach(entry => searchParams.append(entry[0], entry[1]));
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
    params.append(this.key, this.value || '');

    return params.toString();
  }

  toRawString() {
    return `${this.key}=${this.value}`;
  }

  update(param: string | { key: string; value: string; type?: string }) {
    if (typeof param === 'string') {
      const paramObj = QueryParam.parseSingle(param);
      if (!paramObj) {
        throw new Error('failed to update param: input `param` is invalid');
      }
      this.key = typeof paramObj.key === 'string' ? paramObj.key : '';
      this.value = typeof paramObj.value === 'string' ? paramObj.value : '';
    } else if ('key' in param && 'value' in param) {
      this.key = param.key;
      this.value = param.value;
      this.type = param.type;
    } else {
      throw new Error('the param for update must be: string | { key: string; value: string }');
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
  override _kind = 'Url';

  id?: string;
  private urlObject?: URL;
  private origin?: string;
  private queryParams: QueryParam[] = []; // query params are handled separately as URL object encodes content

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
    return new PropertyList<QueryParam>(QueryParam, undefined, this.queryParams);
  }
  get variables(): string[] {
    // TODO: it's usage is unknown
    return [];
  }

  constructor(def: UrlOptions | string) {
    super();
    this.initFields(def);
  }

  private initFields(urlOptions: UrlOptions | string | undefined) {
    if (typeof urlOptions === 'string') {
      // avoid escaping tags by the parser: {% uuid 'v4' %} -> %7B%%20uuid%20'v4'%20%%7D
      const ifUrlIncludesTag = checkIfUrlIncludesTag(urlOptions);
      if (URL.canParse(urlOptions) && !ifUrlIncludesTag) {
        this.urlObject = new URL(urlOptions);
        // maintain query params separately
        this.urlObject.searchParams.forEach((value: string, key: string) => {
          this.queryParams = [...this.queryParams, new QueryParam({ key, value })];
        });
        this.urlObject.search = '';
      } else {
        this.urlObject = undefined;
      }
      this.origin = urlOptions;
    } else if (typeof urlOptions === 'object') {
      const protocolStr = (urlOptions.protocol || '').trim() ? urlOptions.protocol.trim() : 'https://';
      const authStr = urlOptions.auth ? `${urlOptions.auth.username}:${urlOptions.auth.password}@` : '';
      const hostStr = urlOptions.host.join('.');
      const portStr = urlOptions.port ? `:${urlOptions.port}` : '';
      const pathStr =
        urlOptions.path && urlOptions.path.length > 0
          ? `/${urlOptions.path.filter(segment => segment.trim() !== '').join('/')}`
          : '';
      const queryStr =
        urlOptions.query && urlOptions.query.length > 0
          ? '?' + urlOptions.query.map(pair => `${pair.key}=${pair.value}`).join('&')
          : '';
      const hashStr = urlOptions.hash ? `#${urlOptions.hash}` : '';

      const urlString = `${protocolStr}${authStr}${hostStr}${portStr}${pathStr}${queryStr}${hashStr}`;

      if (URL.canParse(urlString)) {
        this.urlObject = new URL(urlString);
        // maintain query params separately
        this.urlObject.searchParams.forEach((value: string, key: string) => {
          this.queryParams = [...this.queryParams, new QueryParam({ key, value })];
        });
        this.urlObject.search = '';
      } else {
        this.urlObject = undefined;
      }
      this.origin = urlString;
    } else {
      throw new TypeError(`url is invalid: ${urlOptions} `); // TODO:
    }
  }

  static _index = 'id';

  static isUrl(obj: object) {
    return '_kind' in obj && obj._kind === 'Url';
  }

  static parse(urlStr: string): UrlOptions | undefined {
    if (URL.canParse(urlStr)) {
      const urlObject = new URL(urlStr);
      const auth =
        urlObject.username === '' ? undefined : { username: urlObject.username, password: urlObject.password };
      const query = Array.from(urlObject.searchParams.entries()).map(entry => ({ key: entry[0], value: entry[1] }));

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

  addQueryParams(params: QueryParamOptions[] | string) {
    if (typeof params === 'string') {
      // URLSearchParams is not used here as it encodes content
      const pairs = params.split('&');
      pairs.forEach(pair => {
        const parts = pair.split('=');
        this.queryParams = [...this.queryParams, new QueryParam({ key: parts[0], value: parts[1] })];
        // this.urlObject.searchParams.append(pair[0], pair[1]);
      });
    } else if (Array.isArray(params)) {
      params.forEach(pair => {
        this.queryParams = [...this.queryParams, new QueryParam({ ...pair })];
      });
    } else {
      throw new TypeError(`addQueryParams: invalid params: ${JSON.stringify(params)}`);
    }
  }

  getHost() {
    if (this.urlObject) {
      return this.urlObject.hostname;
    }
    return '';
  }

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
    return this.queryParams
      .filter(param => !param.disabled)
      .map(param => param.toRawString())
      .join('&');
  }

  getRemote(_forcePort?: boolean) {
    if (this.urlObject) {
      return this.urlObject.host;
    }
    return '';
  }

  removeQueryParams(params: QueryParam[] | string[] | string) {
    if (typeof params === 'string') {
      this.queryParams = this.queryParams.filter(param => param.key !== params);
    } else if (Array.isArray(params)) {
      this.queryParams = this.queryParams.filter(param => {
        const shouldDelete = params.some(paramToRemove => {
          if (typeof paramToRemove === 'string') {
            return param.key === paramToRemove;
          }
          return param.key === paramToRemove.key;
        });

        return !shouldDelete;
      });
    } else {
      throw new TypeError(
        'removeQueryParams: failed to remove query params: unknown params type, only supports QueryParam[], string[] or string',
      );
    }
  }

  override toString(_forceProtocol?: boolean) {
    if (this.urlObject) {
      const newUrlObject = new URL(this.urlObject.toString());
      newUrlObject.search = this.getQueryString();
      const urlInString = newUrlObject.toString();
      if (this.urlObject.pathname === '/' && urlInString === this.origin + '/') {
        // try to avoid replacing empty path with '/'
        return urlInString.slice(0, -1);
      }
      return urlInString;
    }
    return this.origin || '';
  }

  toStringWithoutQuery(_forceProtocol?: boolean) {
    if (this.urlObject) {
      const newUrlObject = new URL(this.urlObject.toString());
      newUrlObject.search = '';
      const urlInString = newUrlObject.toString();
      if (this.urlObject.pathname === '/' && urlInString === this.origin + '/') {
        // try to avoid replacing empty path with '/'
        return urlInString.slice(0, -1);
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

  override id = '';
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
    if (protocolEndPos === -1) {
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

    return (
      this.testProtocol(protoStr) &&
      this.testHost(hostStr) &&
      this.testPath(pathStr) &&
      this.testPort(portStr, protoStr)
    );
  }

  private getHost(urlStr: string) {
    const protocolEndPos = urlStr.indexOf('://') + 3;
    const hostBegPos = protocolEndPos;

    const portBegPos = urlStr.indexOf(':', protocolEndPos);
    const pathBegPos = urlStr.indexOf('/', protocolEndPos);
    const queryBegPos = urlStr.indexOf('?', protocolEndPos);
    const hashBegPos = urlStr.indexOf('?', protocolEndPos);

    let hostEndPos = urlStr.length;
    if (portBegPos !== -1) {
      hostEndPos = portBegPos;
    } else if (pathBegPos !== -1) {
      hostEndPos = pathBegPos;
    } else if (queryBegPos !== -1) {
      hostEndPos = queryBegPos;
    } else if (hashBegPos !== -1) {
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

    for (const [i, patternSegment] of patternSegments.entries()) {
      if (patternSegment === '*') {
        continue;
      } else if (patternSegment !== inputHostSegments[i]) {
        return false;
      }
    }
    return true;
  }

  private getPath(urlStr: string) {
    const protocolEndPos = urlStr.indexOf('://') + 3;
    const hostBegPos = protocolEndPos;
    const pathBegPos = urlStr.indexOf('/', hostBegPos);
    if (pathBegPos === -1) {
      return '';
    }

    const queryBegPos = urlStr.indexOf('?');
    const hashBegPos = urlStr.indexOf('#');
    let pathEndPos = urlStr.length;
    if (queryBegPos !== -1) {
      pathEndPos = queryBegPos;
    } else if (hashBegPos !== -1) {
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

    for (const [i, patternSegment] of patternSegments.entries()) {
      if (patternSegment === '*') {
        continue;
      } else if (patternSegment !== inputSegments[i]) {
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

    if (pathBegPos !== -1) {
      portEndPos = pathBegPos;
    } else if (queryBegPos !== -1) {
      portEndPos = queryBegPos;
    } else if (hashBegPos !== -1) {
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
        return (
          protos.includes('https') &&
          ((port === '443' && portPattern === '') ||
            (port === '' && portPattern === '443') ||
            (port === '' && portPattern === ''))
        );
      } else if (protocol === 'http') {
        return (
          protos.includes('http') &&
          ((port === '80' && portPattern === '') ||
            (port === '' && portPattern === '80') ||
            (port === '' && portPattern === ''))
        );
      }
    }

    return portPattern === port;
  }

  testProtocol(protocol: string) {
    const protoPatterns = this.getProtocols();

    for (const pattern of protoPatterns) {
      if (pattern === '*') {
        return true;
      } else if (pattern === protocol) {
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
  override _kind = 'UrlMatchPatternList';

  constructor(parent: PropertyList<T> | undefined, populate: T[]) {
    super(UrlMatchPattern, undefined, populate);
    this.parent = parent;
  }

  static isUrlMatchPatternList(obj: any) {
    return '_kind' in obj && obj._kind === 'UrlMatchPatternList';
  }

  test(urlStr: string) {
    return this.filter(matchPattern => matchPattern.test(urlStr), {}).length > 0;
  }
}

export function toUrlObject(url: string | Url): Url {
  if (!url) {
    throw new Error('Request URL is not specified');
  }
  return typeof url === 'string' ? new Url(url) : url;
}

/**
 * Resolves the protocol to use for proxy selection when the request URL may still
 * contain unrendered template tags (pre-request scripts run before template rendering).
 * Falls back to parsing the scheme off the raw URL string, and to 'https:' when the
 * scheme or host itself is templated (e.g. "{{ baseUrl }}/path").
 */
export function resolveProtocolForProxy(rawUrl: string): string {
  try {
    return new URL(rawUrl).protocol;
  } catch {
    return 'https:';
  }
}
