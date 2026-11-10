import type { Project, Workspace } from 'insomnia-data';

import type { KonnectPlugin } from './api';

export interface KonnectSyncedRoute {
  controlPlaneId: string;
  controlPlaneName: string;
  region: string;
  serviceId: string;
  routeId: string;
  protocol: string;
}

export type PluginScope = 'route' | 'service' | 'consumer' | 'consumer-group' | 'global';

export interface PluginSelection {
  plugins: KonnectPlugin[];
  appliedNames: string[];
}

export function getPluginScopes(plugin: KonnectPlugin): PluginScope[] {
  const scopes: PluginScope[] = [];
  if (plugin.route) {
    scopes.push('route');
  }
  if (plugin.service) {
    scopes.push('service');
  }
  if (plugin.consumer) {
    scopes.push('consumer');
  }
  if (plugin.consumer_group) {
    scopes.push('consumer-group');
  }
  return scopes.length > 0 ? scopes : ['global'];
}

export interface KonnectLinkedRequest {
  konnectRouteKey?: string | null;
}

/**
 * Resolves the Konnect route behind a synced request. `konnectRouteKey` is a
 * composite key (`${route.id}:${method}:${pathSegment}:${protocol}`). The route
 * id is the first segment; the protocol is the last, which keeps paths that
 * contain `:` safe.
 */
export function resolveKonnectSyncedRoute(
  request: KonnectLinkedRequest,
  workspace: Pick<Workspace, 'konnectServiceId'> | null | undefined,
  project: Pick<Project, 'konnectControlPlaneId' | 'konnectRegion' | 'name'> | null | undefined,
): KonnectSyncedRoute | null {
  if (!request.konnectRouteKey || !workspace?.konnectServiceId || !project?.konnectControlPlaneId) {
    return null;
  }
  if (!project.konnectRegion) {
    return null;
  }
  const segments = request.konnectRouteKey.split(':');
  const routeId = segments[0];
  const protocol = segments.at(-1)?.toLowerCase();
  if (!routeId || !protocol) {
    return null;
  }
  return {
    controlPlaneId: project.konnectControlPlaneId,
    controlPlaneName: project.name,
    region: project.konnectRegion,
    serviceId: workspace.konnectServiceId,
    routeId,
    protocol,
  };
}

/**
 * Returns every applicable plugin instance in API order. It deliberately does
 * not resolve precedence or shadowing: the effective instance can depend on
 * consumer identity and runtime conditions, so show all configured instances
 * and let the user reason about overrides.
 */
export function selectApplicablePlugins(
  plugins: KonnectPlugin[],
  syncedRoute: Pick<KonnectSyncedRoute, 'routeId' | 'serviceId' | 'protocol'>,
): PluginSelection {
  const applicable = plugins.filter(plugin => {
    if (plugin.route && plugin.route.id !== syncedRoute.routeId) {
      return false;
    }
    if (plugin.service && plugin.service.id !== syncedRoute.serviceId) {
      return false;
    }
    if (plugin.protocols?.length && !plugin.protocols.includes(syncedRoute.protocol)) {
      return false;
    }
    return true;
  });

  return {
    plugins: applicable,
    appliedNames: [...new Set(applicable.map(plugin => plugin.name))],
  };
}
