import { reorderObjectMembers } from '../common';
import { DCPlugin, DCRoute, DCService, DCUpstream } from '../types/declarative-config';

export function reorderService(service: DCService): DCService {
  const first: string[] = ['name', 'protocol', 'host', 'port', 'path'];
  const last: string[] = ['tags', 'plugins', 'routes'];
  return reorderObjectMembers(service, first, last);
}

export function reorderUpstream(upstream: DCUpstream): DCUpstream {
  const first: string[] = ['name'];
  const last: string[] = ['tags', 'targets'];
  return reorderObjectMembers(upstream, first, last);
}

export function reorderRoute(route: DCRoute): DCRoute {
  const first: string[] = ['name', 'paths', 'methods'];
  const last: string[] = ['tags', 'plugins'];
  return reorderObjectMembers(route, first, last);
}

export function reorderPlugins(plugins: DCPlugin[]): DCPlugin[] {
  const first: string[] = ['name'];
  const last: string[] = ['tags', 'config'];
  const pluginsOut: DCPlugin[] = [];
  plugins.forEach(plugin => {
    pluginsOut.push(reorderObjectMembers(plugin, first, last));
  });
  return pluginsOut;
}
