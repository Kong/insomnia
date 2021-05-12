import url from 'url';
import slugify from 'slugify';
import {
  OpenApi3Spec,
  OA3PathItem,
  OA3Server,
  OA3Paths,
  OA3Operation,
  OA3SecurityRequirement,
} from './types/openapi3';

export function getServers(obj: OpenApi3Spec | OA3PathItem): OA3Server[] {
  return obj.servers || [];
}

export function getPaths(obj: OpenApi3Spec): OA3Paths {
  return obj.paths || {};
}

export function getAllServers(api: OpenApi3Spec): OA3Server[] {
  const servers = getServers(api);

  for (const p of Object.keys(api.paths)) {
    for (const server of getServers(api.paths[p])) {
      servers.push(server);
    }
  }

  return servers;
}

export function getSecurity(
  obj: OpenApi3Spec | OA3Operation | null,
): OA3SecurityRequirement[] {
  return obj?.security || [];
}

interface SlugifyOptions {
  replacement?: string;
  lower?: boolean;
}

export function getName(
  api: OpenApi3Spec,
  defaultValue?: string,
  slugifyOptions?: SlugifyOptions,
  isKubernetes?: boolean,
): string {
  let rawName = '';
  // Get $.info.x-kubernetes-ingress-metadata.name
  rawName = isKubernetes && api.info?.['x-kubernetes-ingress-metadata']?.name;
  // Get $.x-kong-name
  rawName = rawName || api['x-kong-name'];
  // Get $.info.title
  rawName = rawName || api.info?.title;
  // Make sure the name is a string
  const defaultName = defaultValue || 'openapi';
  const name = typeof rawName === 'string' && rawName ? rawName : defaultName;
  // Sluggify
  return generateSlug(name, slugifyOptions);
}

export function generateSlug(str: string, options: SlugifyOptions = {}): string {
  options.replacement = options.replacement || '_';
  options.lower = options.lower || false;
  return slugify(str, options);
}

/** characters in curly brances not immediately followed by `://`, e.g. `{foo}` will match but `{foo}://` will not. */
const pathVariableSearchValue = /{([^}]+)}(?!:\/\/)/g;

export function pathVariablesToRegex(p: string): string {
  // match anything except whitespace and '/'
  const result = p.replace(pathVariableSearchValue, '(?<$1>[^\\/\\s]+)');
  // add a line ending because it is a regex
  return result + '$';
}

export function getPluginNameFromKey(key: string): string {
  return key.replace(/^x-kong-plugin-/, '');
}

export function isPluginKey(key: string): boolean {
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

export function getMethodAnnotationName(method: HttpMethodType): string {
  return `${method}-method`.toLowerCase();
}

export function parseUrl(
  urlStr: string,
): {
  host: string;
  hostname: string;
  port: string;
  protocol: string;
  pathname: string;
} {
  const parsed = url.parse(urlStr);

  if (!parsed.port && parsed.protocol === 'https:') {
    parsed.port = '443';
  } else if (!parsed.port && parsed.protocol === 'http:') {
    parsed.port = '80';
  }

  parsed.protocol = parsed.protocol || 'http:';

  if (parsed.hostname && parsed.port) {
    parsed.host = `${parsed.hostname}:${parsed.port}`;
  } else if (parsed.hostname) {
    parsed.host = parsed.hostname;
  }

  return parsed;
}

export function fillServerVariables(server: OA3Server): string {
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

export function joinPath(p1: string, p2: string): string {
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
