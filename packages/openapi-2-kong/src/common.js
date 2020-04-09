// @flow
import url from 'url';
import slugify from 'slugify';

export function getServers(obj: OpenApi3Spec | OA3PathItem): Array<OA3Server> {
  return obj.servers || [];
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
  obj: OpenApi3Spec | OA3Operation,
): Array<OA3SecurityRequirement> | null {
  return obj.security || [];
}

export function getName(
  obj: OpenApi3Spec | OA3Operation,
  defaultValue?: string = 'openapi',
  slugifyOptions?: {replacement: string, lower: boolean},
): string {
  let name: string = '';

  if ((obj: any)['x-kong-name']) {
    name = (obj: any)['x-kong-name'];
  }

  if (!name && obj.info && typeof obj.info.title === 'string') {
    name = obj.info.title;
  }

  return generateSlug(name || defaultValue, slugifyOptions);
}

export function generateSlug(
  str: string,
  options: {replacement: string, lower: boolean} = {},
): string {
  options.replacement = options.replacement || '_';
  options.lower = options.lower || false;
  return slugify(str, options);
}

export function pathVariablesToRegex(p: string): string {
  const result = p.replace(/{([^}]+)}/g, '(?<$1>\\S+)');
  if (result === p) {
    return result;
  }

  // If anything was replaced, it's a regex, so add a line-ending match
  return result + '$';
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
