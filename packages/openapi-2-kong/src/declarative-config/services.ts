import {
  fillServerVariables,
  generateSlug,
  getAllServers,
  getName,
  hasUpstreams,
  HttpMethod,
  parseUrl,
  pathVariablesToRegex,
} from '../common';
import { DCRoute, DCService } from '../types/declarative-config';
import { xKongName, xKongServiceDefaults } from '../types/kong';
import { OA3PathItem, OA3Server, OpenApi3Spec } from '../types/openapi3';
import {
  generateGlobalPlugins,
  generateOperationPlugins,
  generatePlugins,
  getRequestValidatorPluginDirective,
} from './plugins';
import { generateSecurityPlugins } from './security-plugins';
import { appendUpstreamToName } from './upstreams';

export function generateServices(api: OpenApi3Spec, tags: string[]) {
  const servers = getAllServers(api);

  if (servers.length === 0) {
    throw new Error('no servers defined in spec');
  }

  // only support one service for now
  const service = generateService(servers[0], api, tags);
  return [service];
}

export function generateService(server: OA3Server, api: OpenApi3Spec, tags: string[]) {
  const serverUrl = fillServerVariables(server);
  const name = getName(api);
  const parsedUrl = parseUrl(serverUrl);

  let host = parsedUrl.hostname;
  if (hasUpstreams(api)) {
    host =  appendUpstreamToName(name);
  }

  // Service plugins
  const globalPlugins = generateGlobalPlugins(api, tags);
  const serviceDefaults = api[xKongServiceDefaults] || {};

  if (typeof serviceDefaults !== 'object') {
    throw new Error(`expected '${xKongServiceDefaults}' to be an object`);
  }

  const service: DCService = {
    ...serviceDefaults,
    name,
    // remove semicolon i.e. convert `https:` to `https`
    protocol: parsedUrl?.protocol?.substring(0, parsedUrl.protocol.length - 1),
    host,
    // not a hostname, but the Upstream name
    port: Number(parsedUrl.port || '80'),
    path: parsedUrl.pathname,
    plugins: globalPlugins.plugins,
    routes: [],
    tags,
  };
  const routeDefaultsRoot = api['x-kong-route-defaults'] || {};

  if (typeof routeDefaultsRoot !== 'object') {
    throw new Error('expected root-level \'x-kong-route-defaults\' to be an object');
  }

  for (const routePath of Object.keys(api.paths)) {
    const pathItem: OA3PathItem = api.paths[routePath];
    const routeDefaultsPath = api.paths[routePath]['x-kong-route-defaults'] || routeDefaultsRoot;

    if (typeof routeDefaultsPath !== 'object') {
      throw new Error(`expected 'x-kong-route-defaults' to be an object (at path '${routePath}')`);
    }

    const pathValidatorPlugin = getRequestValidatorPluginDirective(pathItem);
    const pathPlugins = generatePlugins(pathItem, tags);

    for (const method of Object.keys(pathItem)) {
      if (
        method !== 'get' &&
        method !== 'put' &&
        method !== 'post' &&
        method !== 'delete' &&
        method !== 'options' &&
        method !== 'head' &&
        method !== 'patch' &&
        method !== 'trace'
      ) {
        continue;
      }

      const operation = pathItem[method];
      const routeDefaultsOperation = pathItem?.[method]?.['x-kong-route-defaults'] || routeDefaultsPath;

      if (typeof routeDefaultsOperation !== 'object') {
        throw new Error(
          `expected 'x-kong-route-defaults' to be an object (at operation '${method}' of path '${routePath}')`,
        );
      }

      if (!operation) {
        continue;
      }

      // Create the base route object
      const fullPathRegex = pathVariablesToRegex(routePath);
      const route: DCRoute = {
        ...routeDefaultsOperation as DCRoute,
        tags,
        name: generateRouteName(api, routePath, method),
        methods: [method.toUpperCase()],
        paths: [fullPathRegex],
      };

      if (route.strip_path === undefined) {
        // must override the Kong default of 'true' since we match based on full path regexes, which would lead Kong to always strip the full path down to a single '/' if it used that default.
        route.strip_path = false;
      }

      // Generate generic and security-related plugin objects
      const securityPlugins = generateSecurityPlugins(operation, api, tags);

      // Path plugin takes precedence over global
      const parentValidatorPlugin = pathValidatorPlugin || globalPlugins.requestValidatorPlugin;

      const regularPlugins = generateOperationPlugins({
        operation,
        pathPlugins,
        parentValidatorPlugin,
        tags,
      });

      const plugins = [...regularPlugins, ...securityPlugins];
      // Add plugins if there are any
      if (plugins.length) {
        route.plugins = plugins;
      }

      service.routes.push(route);
    }
  }

  return service;
}

export function generateRouteName(
  api: OpenApi3Spec,
  routePath: string,
  method: keyof typeof HttpMethod,
) {
  const name = getName(api);
  const pathItem = api.paths[routePath];

  if (typeof pathItem?.[method]?.[xKongName] === 'string') {
    const opsName = generateSlug(pathItem?.[method]?.[xKongName] as string);
    return `${name}-${opsName}`;
  }

  if (pathItem?.[method]?.operationId) {
    const opsName = generateSlug(pathItem?.[method]?.operationId as string);
    return `${name}-${opsName}`;
  }

  // replace all `/` with `-` except the ones at the beginning or end of a string
  const replacedRoute = routePath.replace(/(?!^)\/(?!$)/g, '-');
  const pathSlug = generateSlug(pathItem[xKongName] || replacedRoute);
  return `${name}${pathSlug ? `-${pathSlug}` : ''}-${method}`;
}
