import {
  fillServerVariables,
  generateSlug,
  getAllServers,
  getName,
  pathVariablesToRegex,
  HttpMethod,
  parseUrl,
} from '../common';
import { generateSecurityPlugins } from './security-plugins';
import {
  generateOperationPlugins,
  generatePathPlugins,
  generateGlobalPlugins,
  getRequestValidatorPluginDirective,
} from './plugins';
import { DCService, DCRoute } from '../types/declarative-config';
import { OpenApi3Spec, OA3Server, OA3PathItem, OA3Operation } from '../types/openapi3';
import { reorderService, reorderRoute, reorderPlugins } from './common';

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
  // Service plugins
  const globalPlugins = generateGlobalPlugins(api, tags);
  // x-kong-service-defaults is free format so we do not want type checking.
  // If added, it would tightly couple these objects to Kong, and that would make future maintenance a lot harder.
  // $FlowFixMe
  const serviceDefaults = api['x-kong-service-defaults'] || {};

  if (typeof serviceDefaults !== 'object') {
    throw new Error('expected \'x-kong-service-defaults\' to be an object');
  }

  const service: DCService = {
    ...serviceDefaults,
    name,
    // remove semicolon i.e. convert `https:` to `https`
    protocol: parsedUrl.protocol.substring(0, parsedUrl.protocol.length - 1),
    host: name,
    // not a hostname, but the Upstream name
    port: Number(parsedUrl.port || '80'),
    path: parsedUrl.pathname,
    plugins: reorderPlugins(globalPlugins.plugins),
    routes: [],
    tags,
  };
  // x-kong-route-defaults is free format so we do not want type checking.
  // If added, it would tightly couple these objects to Kong, and that would make future maintenance a lot harder.
  // $FlowFixMe
  const routeDefaultsRoot = api['x-kong-route-defaults'] || {};

  if (typeof routeDefaultsRoot !== 'object') {
    throw new Error('expected root-level \'x-kong-route-defaults\' to be an object');
  }

  for (const routePath of Object.keys(api.paths)) {
    const pathItem: OA3PathItem = api.paths[routePath];
    // $FlowFixMe
    const routeDefaultsPath = api.paths[routePath]['x-kong-route-defaults'] || routeDefaultsRoot;

    if (typeof routeDefaultsPath !== 'object') {
      throw new Error(`expected 'x-kong-route-defaults' to be an object (at path '${routePath}')`);
    }

    const pathValidatorPlugin = getRequestValidatorPluginDirective(pathItem);
    const pathPlugins = generatePathPlugins(pathItem, tags);

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

      const operation: OA3Operation | null | undefined = pathItem[method];
      // $FlowFixMe
      const routeDefaultsOperation = pathItem[method]['x-kong-route-defaults'] || routeDefaultsPath;

      if (typeof routeDefaultsOperation !== 'object') {
        throw new Error(
          `expected 'x-kong-route-defaults' to be an object (at operation '${method}' of path '${routePath}')`,
        );
      }

      // This check is here to make Flow happy
      if (!operation) {
        continue;
      }

      // Create the base route object
      const fullPathRegex = pathVariablesToRegex(routePath);
      // $FlowFixMe
      const route: DCRoute = {
        ...routeDefaultsOperation,
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
      const regularPlugins = generateOperationPlugins(
        operation,
        pathPlugins,
        pathValidatorPlugin || globalPlugins.requestValidatorPlugin, // Path plugin takes precedence over global
        tags,
      );
      const plugins = [...regularPlugins, ...securityPlugins];

      // Add plugins if there are any
      if (plugins.length) {
        route.plugins = reorderPlugins(plugins);
      }

      service.routes.push(reorderRoute(route));
    }
  }

  return reorderService(service);
}

export function generateRouteName(
  api: OpenApi3Spec,
  routePath: string,
  method: keyof typeof HttpMethod,
) {
  const name = getName(api);
  const pathItem = api.paths[routePath];

  if (pathItem[method] && typeof pathItem[method]['x-kong-name'] === 'string') {
    const opsName = generateSlug(pathItem[method]['x-kong-name']);
    return `${name}-${opsName}`;
  }

  if (pathItem[method] && pathItem[method].operationId) {
    const opsName = generateSlug(pathItem[method].operationId);
    return `${name}-${opsName}`;
  }

  // replace all `/` with `-` except the ones at the beginng or end of a string
  const replacedRoute = routePath.replace(/(?!^)\/(?!$)/g, '-');
  const pathSlug = generateSlug(pathItem['x-kong-name'] || replacedRoute);
  return `${name}${pathSlug ? `-${pathSlug}` : ''}-${method}`;
}
