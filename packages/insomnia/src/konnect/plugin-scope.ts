import type { Project, Request, Workspace } from 'insomnia-data';

import type { KonnectPlugin } from './api';

export interface KonnectSyncedRoute {
  controlPlaneId: string;
  controlPlaneName: string;
  region: string;
  serviceId: string;
  routeId: string;
  protocol: string;
}

export type PluginScope = 'route' | 'service' | 'global';

export interface PluginGroup {
  scope: PluginScope;
  plugins: KonnectPlugin[];
}

export interface PluginSelection {
  groups: PluginGroup[];
  conditional: KonnectPlugin[];
  appliedNames: string[];
}

/**
 * Resolves the Konnect route behind a synced request. `konnectRouteKey` is a
 * composite key (`${route.id}:${method}:${pathSegment}:${protocol}`). The route
 * id is the first segment; the protocol is the last, which keeps paths that
 * contain `:` safe.
 */
export function resolveKonnectSyncedRoute(
  request: Pick<Request, 'konnectRouteKey'>,
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
 * Returns every applicable plugin instance, grouped by scope. It deliberately
 * does not resolve precedence or shadowing: the effective instance can depend
 * on consumer identity and runtime conditions, so show all configured
 * instances and let the user reason about overrides.
 *
 * Consumer/consumer-group scoped and conditional plugins are reported
 * separately: Insomnia cannot know which consumer will authenticate a request,
 * or evaluate a CEL condition locally.
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

  const conditional: KonnectPlugin[] = [];
  const groups: PluginGroup[] = [
    { scope: 'route', plugins: [] },
    { scope: 'service', plugins: [] },
    { scope: 'global', plugins: [] },
  ];
  for (const plugin of applicable) {
    if (plugin.consumer || plugin.consumer_group || plugin.condition) {
      conditional.push(plugin);
      continue;
    }
    const scope: PluginScope = plugin.route ? 'route' : plugin.service ? 'service' : 'global';
    groups.find(group => group.scope === scope)!.plugins.push(plugin);
  }

  return {
    groups,
    conditional,
    appliedNames: [...new Set(applicable.map(plugin => plugin.name))],
  };
}
