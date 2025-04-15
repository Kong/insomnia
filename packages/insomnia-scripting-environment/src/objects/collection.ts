
/**
 * This module exports various types and interfaces related to the Insomnia scripting environment.
 *
 * - `RequestAuth`: Represents authentication details for a request.
 * - `Certificate`: Represents SSL/TLS certificate settings details.
 * - `Cookie`, `CookieList`: Represents HTTP cookies and a list of cookies.
 * - `Header`, `HeaderList`: Represents HTTP headers and a list of headers.
 * - `Property`, `PropertyBase`, `PropertyList`: Represents generic properties, their base structure, and a list of properties.
 * - `ProxyConfig`, `ProxyConfigList`: Represents proxy configuration details and a list of proxy configurations.
 * - `FormParam`, `Request`, `RequestBody`: Represents form parameters, HTTP requests, and request bodies.
 * - `Response`: Represents an HTTP response.
 * - `QueryParam`, `Url`, `UrlMatchPattern`, `UrlMatchPatternList`: Represents query parameters, URLs, URL match patterns, and a list of URL match patterns.
 * - `Variable`, `VariableList`: Represents variables and a list of variables.
 * ```*/
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
