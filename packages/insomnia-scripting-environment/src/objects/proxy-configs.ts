import { getExistingConsole } from './console';
import { Property, PropertyList } from './properties';
import type { Url } from './urls';
import { UrlMatchPattern, UrlMatchPatternList } from './urls';

/**
 * Represents the configuration options for a proxy.
 *
 * @property match - A string pattern to match URLs for which the proxy should be used. It is used to initialize the {@link UrlMatchPattern} object internally.
 * @property host - The hostname or IP address of the proxy server.
 * @property port - (Optional) The port number of the proxy server.
 * @property tunnel - A boolean indicating whether to use tunneling for the proxy connection.
 * @property disabled - (Optional) A boolean indicating whether the proxy is disabled, default is false.
 * @property authenticate - A boolean indicating whether authentication is required for the proxy.
 * @property username - The username for proxy authentication.
 * @property password - The password for proxy authentication.
 * @property bypass - (Optional) An array of strings specifying hostnames or IPs to bypass the proxy.
 * @property protocol - The protocol used by the proxy.
 */
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

/**
 * Represents a proxy configuration object used to define the settings for a proxy server.
 *
 * This class provides methods to construct, update, and test proxy configurations, as well
 * as retrieve information such as the proxy URL and supported protocols.
 *
 * The proxy configuration includes properties such as the host, port, authentication
 * credentials, tunneling options, and bypass list.
 *
 * @extends Property
 */
export class ProxyConfig extends Property {
  /** @ignore */
  override _kind = 'ProxyConfig';

  /**
   * The hostname or IP address of the proxy server.
   */
  host: string;
  /**
   * A string pattern used to match specific criteria or conditions.
   * This can be used for filtering or identifying relevant configurations.
   */
  match: string;
  /**
   * The port number to be used for the proxy configuration.
   * This is an optional property and, if not specified, the default port
   * for the protocol being used will be applied.
   */
  port?: number;

  tunnel: boolean;

  /**
   * Indicates whether authentication is required for the proxy configuration.
   */
  authenticate: boolean;
  /**
   * The username associated with the proxy configuration.
   */
  username: string;
  /**
   * The password associated with the proxy configuration.
   */
  password: string;
  /**
   * A list of hostnames or IP addresses to bypass the proxy for.
   */
  bypass: string[]; // it is for compatibility with Insomnia's bypass list
  /**
   * The protocol used in the proxy configuration, such as "http" or "https".
   */
  protocol: string;

  // following properties are hidden as they are not used while must be exposed
  /** @ignore */
  static authenticate = false;
  /** @ignore */
  static bypass: UrlMatchPatternList<UrlMatchPattern> = new UrlMatchPatternList<UrlMatchPattern>(undefined, []);
  /** @ignore */
  static host = '';
  /** @ignore */
  static match = '';
  /** @ignore */
  static password = '';
  /** @ignore */
  static port?: number = undefined;
  /** @ignore */
  static tunnel = false; // unsupported
  /** @ignore */
  static username = '';
  /** @ignore */
  static protocol = 'https:';

  /**
   * Constructs a new instance of the proxy configuration object.
   *
   * @param def - The definition object containing the proxy configuration properties.
   * @param def.id - (Optional) The unique identifier for the proxy configuration.
   * @param def.name - (Optional) The name of the proxy configuration.
   * @param def.match - The match pattern for the proxy configuration. It is used to initialize the {@link UrlMatchPattern} object internally.
   * @param def.host - The host address of the proxy server.
   * @param def.port - (Optional) The port number of the proxy server.
   * @param def.tunnel - Indicates whether the proxy uses tunneling.
   * @param def.disabled - (Optional) Indicates whether the proxy configuration is disabled.
   * @param def.authenticate - Indicates whether the proxy requires authentication.
   * @param def.username - The username for proxy authentication.
   * @param def.password - The password for proxy authentication.
   * @param def.bypass - (Optional) A list of hosts to bypass the proxy.
   * @param def.protocol - The protocol used by the proxy (e.g., HTTP, HTTPS).
   */
  constructor(def: {
    id?: string;
    name?: string;

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

  static override _index = 'key';

  /**
   * Determines if the given object is a ProxyConfig.
   * @param obj - The object to check.
   * @returns `true` if the object is a ProxyConfig, otherwise `false`.
   */
  static isProxyConfig(obj: object) {
    return '_kind' in obj && obj._kind === 'ProxyConfig';
  }

  /**
   * Retrieves the list of protocols specified in the match pattern.
   *
   * The match pattern is expected to follow a format such as
   * 'http+https://example.com/*', where protocols are separated by a '+'.
   * This method parses the match pattern and extracts the protocols.
   *
   * @returns {string[]} An array of protocol strings extracted from the match pattern.
   */
  getProtocols(): string[] {
    // match field example: 'http+https://example.com/*'
    const urlMatch = new UrlMatchPattern(this.match);
    return urlMatch.getProtocols();
  }

  /**
   * Constructs and returns the full proxy URL as a string.
   *
   * The URL is built based on the protocol, host, port, and optional
   * authentication credentials (username and password) of the proxy.
   *
   * @returns {string} The full proxy URL in the format:
   *   - With authentication: `protocol://username:password@host:port`
   *   - Without authentication: `protocol://host:port`
   */
  getProxyUrl(): string {
    // http://proxy_username:proxy_password@proxy.com:8080
    const portSegment = this.port === undefined ? '' : `:${this.port}`;

    if (this.authenticate) {
      return `${this.protocol}//${this.username}:${this.password}@${this.host}${portSegment}`;
    }
    return `${this.protocol}//${this.host}${portSegment}`;
  }

  /**
   * Tests whether a given URL matches the proxy configuration.
   *
   * @param url - The URL to test. If not provided, the method will return `false`.
   * @returns `true` if the URL matches the proxy configuration and is not bypassed;
   *          otherwise, `false`.
   */
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

  /**
   * Updates the proxy configuration with the provided options.
   *
   * @param options - An object containing the new proxy configuration options.
   *                  The `bypass` and `protocol` properties are omitted and cannot be updated.
   *                  The following properties can be updated:
   *                  - `host`: The hostname or IP address of the proxy server.
   *                  - `match`: A pattern to match URLs for which the proxy should be used.
   *                  - `port`: The port number of the proxy server.
   *                  - `tunnel`: A boolean indicating whether to use tunneling.
   *                  - `authenticate`: A boolean indicating whether authentication is required.
   *                  - `username`: The username for proxy authentication.
   *                  - `password`: The password for proxy authentication.
   */
  update(options: Omit<ProxyConfigOptions, 'bypass' | 'protocol'>) {
    this.host = options.host;
    this.match = options.match;
    this.port = options.port;
    this.tunnel = options.tunnel;
    this.authenticate = options.authenticate;
    this.username = options.username;
    this.password = options.password;
  }

  /**
   * Updates the list of protocols. Currently this method is not supported in Insomnia
   *
   * @param _protocols - An array of protocol strings to update.
   * @throws {Error} Always throws an error indicating that this method is not supported.
   */
  updateProtocols(_protocols: string[]) {
    // In Insomnia there is no whitelist while there is a blacklist
    throw new Error('updateProtocols is not supported in Insomnia');
  }
}

// example:
// myProxyConfigs = new ProxyConfigList({}, [
//     {match: 'https://example.com/*', host: 'proxy.com', port: 8080, tunnel: true},
//     {match: 'http+https://example2.com/*', host: 'proxy2.com'},
// ]);

/**
 * A specialized list class for managing `ProxyConfig` objects.
 *
 * @template T - A type that extends `ProxyConfig`.
 */
export class ProxyConfigList<T extends ProxyConfig> extends PropertyList<T> {
  /**
   * Constructs a new instance of a list of ProxyConfig.
   *
   * @param parent - The parent `PropertyList` instance, or `undefined` if there is no parent.
   * @param populate - An array of items of type `T` used to populate the list.
   */
  constructor(parent: PropertyList<T> | undefined, populate: T[]) {
    super(ProxyConfig, undefined, populate);
    this.parent = parent;
  }

  /**
   * Determines if the given object is a ProxyConfigList.
   *
   * @param obj - The object to check.
   * @returns `true` if the object is a ProxyConfigList, otherwise `false`.
   */
  static isProxyConfigList(obj: any) {
    return '_kind' in obj && obj._kind === 'ProxyConfigList';
  }

  /**
   * Resolves the proxy configuration for a given URL.
   * It only returns the first one if multiple matches are found.
   *
   * @param url - The URL to resolve the proxy configuration for. If not provided, `null` is returned.
   * @returns The first matching proxy configuration as a JSON object, or `null` if no match is found.
   */
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

/** @ignore */
export function transformToSdkProxyOptions(
  httpProxy: string,
  httpsProxy: string,
  proxyEnabled: boolean,
  noProxy: string,
) {
  const bestProxy = httpsProxy || httpProxy || '';
  const enabledProxy = proxyEnabled && bestProxy.trim() !== '';
  const bypassProxyList = noProxy ? noProxy.split(',').map(urlStr => urlStr.trim()) : [];
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
    if (!bestProxy.includes('://')) {
      getExistingConsole().warn(`The protocol is missing for proxy, 'https:' is enabled for: ${bestProxy}`);
      sanitizedProxy = `https://${bestProxy}`;
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
      throw new Error(`Failed to parse proxy (${sanitizedProxy}): ${e.message}`);
    }
  }

  return proxy;
}
