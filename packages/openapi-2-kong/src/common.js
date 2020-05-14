// @flow
import url from 'url';
import slugify from 'slugify';

export function getServers(obj: OpenApi3Spec | OA3PathItem): Array<OA3Server> {
  return obj.servers || [];
}

export function getPaths(obj: OpenApi3Spec): OA3Paths {
  return obj.paths || {};
}

export function getAllServers(api: OpenApi3Spec): Array<OA3Server> {
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
): Array<OA3SecurityRequirement> {
  return obj?.security || [];
}

type SlugifyOptions = {
  replacement?: string,
  lower?: boolean,
};

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

const pathVariableSearchValue = /{([^}]+)}(?!:\/\/)/g;

export function pathVariablesToRegex(p: string): string {
  const result = p.replace(pathVariableSearchValue, '(?<$1>\\S+)');
  if (result === p) {
    return result;
  }

  // If anything was replaced, it's a regex, so add a line-ending match
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
};

export function isHttpMethodKey(key: string): boolean {
  const uppercaseKey = key.toUpperCase();
  return Object.values(HttpMethod).some(m => m === uppercaseKey);
}

export function getMethodAnnotationName(method: HttpMethodType): string {
  return `${method}-method`.toLowerCase();
}

export function parseUrl(
  urlStr: string,
): {|
  host: string,
  hostname: string,
  port: string,
  protocol: string,
  pathname: string,
|} {
  const parsed: Object = url.parse(urlStr);

  if (!parsed.port && parsed.protocol === 'https:') {
    parsed.port = '443';
  } else if (!parsed.port && parsed.protocol === 'http:') {
    parsed.port = '80';
  }

  parsed.protocol = parsed.protocol || 'http:';
  parsed.host = `${parsed.hostname}:${parsed.port}`;

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
