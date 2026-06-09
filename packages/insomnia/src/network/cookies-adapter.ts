// Imports renderer by default; esbuild node builds alias this to cookies-adapter.node
export { fromJSON, parse, toString, getCookiesForUrl, addSetCookies, getResponseCookiesFromHeaders } from './cookies-adapter.renderer';
