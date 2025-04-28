/**
 *
 * This module exports various types and interfaces related to the Insomnia scripting environment.
 *
 * - {@link RequestAuth}: Represents authentication details for a request.
 * - {@link Certificate}: Represents SSL/TLS certificate settings details.
 * - {@link Cookie}, {@link CookieList} : Represents HTTP cookies and a list of cookies.
 * - {@link Header}, {@link HeaderList} : Represents HTTP headers and a list of headers.
 * - {@link Property}, {@link PropertyBase}, {@link PropertyList} : Represents generic properties, their base structure, and a list of properties.
 * - {@link ProxyConfig}, {@link ProxyConfigList} : Represents proxy configuration details and a list of proxy configurations.
 * - {@link FormParam}, {@link Request}, {@link RequestBody} : Represents form parameters, HTTP requests, and request bodies.
 * - {@link Response}: Represents an HTTP response.
 * - {@link QueryParam}, {@link Url}, {@link UrlMatchPattern}, {@link UrlMatchPatternList} : Represents query parameters, URLs, URL match patterns, and a list of URL match patterns.
 * - {@link Variable}, {@link VariableList} : Represents variables and a list of variables.
 *
 * @example
 * ```javascript
 * const { Cookie } = require("insomnia-collection");
 * const cookie = new Cookie({ key: "expire", value: "1024" });
 * console.log(cookie);
 * ```
 * @module
 **/

export { RequestAuth } from './auth';
export { Certificate } from './certificates';
export { Cookie, CookieList } from './cookies';
export { Header, HeaderList } from './headers';
export { Property, PropertyBase, PropertyList } from './properties';
export { ProxyConfig, ProxyConfigList } from './proxy-configs';
export { FormParam, Request, RequestBody } from './request';
export { Response } from './response';
export { QueryParam, Url, UrlMatchPattern, UrlMatchPatternList } from './urls';
export { Variable, VariableList } from './variables';
