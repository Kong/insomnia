// @flow
import SwaggerParser from 'swagger-parser';
import url from 'url';

export async function parseSpec(spec: string | Object): Promise<OpenApi3Spec> {
  let api: OpenApi3Spec;

  if (typeof spec === 'string') {
    try {
      api = JSON.parse(spec);
    } catch (err) {
      api = SwaggerParser.YAML.parse(spec);
    }
  } else {
    api = JSON.parse(JSON.stringify(spec));
  }

  // Ensure it has some required properties to make parsing
  // a bit less strict

  if (!api.info) {
    api.info = {};
  }

  if (api.openapi === '3.0') {
    api.openapi = '3.0.0';
  }

  return SwaggerParser.dereference(api);
}

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

export function getName(obj: OpenApi3Spec | OA3Operation): string {
  let name;

  if ((obj: any)['x-kong-name']) {
    name = (obj: any)['x-kong-name'];
  }

  if (!name && obj.info && obj.info.title) {
    name = obj.info.title;
  }

  return generateSlug(name || 'openapi');
}

export function generateSlug(str: string): string {
  return str.replace(/[\s_\-.~,]/g, '_');
}

export function pathVariablesToRegex(p: string): string {
  return p.replace(/{([^}]+)}/g, '(?<$1>\\S+)') + '$';
}

export function parseUrl(
  urlStr: string,
): {|
  host: string,
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

  parsed.host = `${parsed.hostname}:${parsed.port}`;
  return parsed;
}

export function joinPath(p1: string, p2: string): string {
  p1 = p1.replace(/\/$/, '');
  p2 = p2.replace(/^\//, '');

  return `${p1}/${p2}`;
}
