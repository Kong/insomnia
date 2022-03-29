import slugify from 'slugify';

import { xKongName, xKongUpstreamDefaults } from './types/kong';
import {
  OA3Operation,
  OA3PathItem,
  OA3Server,
  OpenApi3Spec,
} from './types/openapi3';

export const getServers = (obj: OpenApi3Spec | OA3PathItem) => obj.servers || [];

export const getPaths = (obj: OpenApi3Spec) => obj.paths || {};

export function getAllServers(api: OpenApi3Spec) {
  const servers = getServers(api);

  for (const path of Object.keys(api.paths)) {
    for (const server of getServers(api.paths[path])) {
      servers.push(server);
    }
  }

  return servers;
}

export const getSecurity = (obj: OpenApi3Spec | OA3Operation | null) => obj?.security || [];

interface SlugifyOptions {
  replacement?: string;
  lower?: boolean;
}

export function getName(
  api: OpenApi3Spec,
  defaultValue?: string,
  slugifyOptions?: SlugifyOptions,
  isKubernetes?: boolean,
) {
  let rawName: string | undefined = '';

  // Get $.info.x-kubernetes-ingress-metadata.name
  rawName = isKubernetes ? api.info?.['x-kubernetes-ingress-metadata']?.name : '';

  // Get $.x-kong-name
  rawName = rawName || api[xKongName];

  // Get $.info.title
  rawName = rawName || api.info?.title;

  // Make sure the name is a string
  const defaultName = defaultValue || 'openapi';
  const name = typeof rawName === 'string' && rawName ? rawName : defaultName;

  // Slugify
  return generateSlug(name, slugifyOptions);
}

export function generateSlug(str: string, options: SlugifyOptions = {}) {
  options.replacement = options.replacement || '_';
  options.lower = options.lower || false;
  return slugify(str, options);
}

/** characters in curly braces not immediately followed by `://`, e.g. `{foo}` will match but `{foo}://` will not. */
const pathVariableSearchValue = /{([^}]+)}(?!:\/\/)/g;

export function pathVariablesToRegex(p: string) {
  // match anything except whitespace and '/'
  const result = p.replace(pathVariableSearchValue, '(?<$1>[^\\/]+)');
  // add a line ending because it is a regex
  return result + '$';
}

export function getPluginNameFromKey(key: string) {
  return key.replace(/^x-kong-plugin-/, '');
}

export function isPluginKey(key: string) {
  return key.indexOf('x-kong-plugin-') === 0;
}

export const HttpMethod = {
  get: 'GET',
  put: 'PUT',
  post: 'POST',
  delete: 'DELETE',
  options: 'OPTIONS',
  head: 'HEAD',
  patch: 'PATCH',
  trace: 'TRACE',
} as const;

export type HttpMethodType = typeof HttpMethod[keyof typeof HttpMethod];

export function isHttpMethodKey(key: string): key is HttpMethodType {
  const uppercaseKey = key.toUpperCase();
  return Object.values(HttpMethod).some(method => method === uppercaseKey);
}

export function getMethodAnnotationName(method: HttpMethodType) {
  return `${method}-method`.toLowerCase();
}

const protocolToPort = (protocol: unknown) => protocol === 'https:' ? '443' : protocol === 'http:' ? '80' : '';

export function parseUrl(urlStr: string) {
  // fallback to locahost: https://swagger.io/docs/specification/api-host-and-base-path/#relative-urls
  const { port, protocol, hostname, pathname } = new URL(urlStr, 'http://localhost');
  // fallback to protocol derived port
  const updatedPort = port || protocolToPort(protocol);
  return {
    port: updatedPort,
    host: updatedPort ? `${hostname}:${updatedPort}` : hostname,
    protocol,
    hostname,
    pathname,
  };
}

export function fillServerVariables(server: OA3Server) {
  let finalUrl = server.url;
  const variables = server.variables || {};

  for (const name of Object.keys(variables)) {
    const defaultValue = variables[name].default;

    if (!defaultValue) {
      throw new Error(`Server variable "${name}" missing default value`);
    }

    finalUrl = finalUrl.replace(`{${name}}`, defaultValue);
  }

  return finalUrl;
}

export function joinPath(p1: string, p2: string) {
  p1 = p1.replace(/\/$/, '');
  p2 = p2.replace(/^\//, '');
  return `${p1}/${p2}`;
}

// Select first unique instance of an array item depending on the property selector
export function distinctByProperty<T>(arr: T[], propertySelector: (item: T) => any): T[] {
  const result: T[] = [];
  const set = new Set();

  for (const item of arr.filter(i => i)) {
    const selector = propertySelector(item);

    if (set.has(selector)) {
      continue;
    }

    set.add(selector);
    result.push(item);
  }

  return result;
}

export const hasUpstreams = (api: OpenApi3Spec) => {
  const hasUpstreamDefaults = !!api[xKongUpstreamDefaults];
  const hasMoreThanOneServer = (api.servers?.length || 0) > 1;
  return hasUpstreamDefaults || hasMoreThanOneServer;
};
