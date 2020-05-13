// @flow

import {
  getPaths,
  getPluginNameFromKey,
  getServers,
  isHttpMethodKey,
  isPluginKey,
} from '../common';
import { generateSecurityPlugins } from '../declarative-config/security-plugins';

export function flattenPluginDocuments(plugins: Plugins): Array<KubernetesPluginConfig> {
  const all: Array<KubernetesPluginConfig> = [];

  const { global, servers, paths } = plugins;

  all.push(...global);
  servers.forEach(s => {
    all.push(...s.plugins);
  });
  paths.forEach(s => {
    all.push(...s.plugins);

    s.operations.forEach(o => {
      all.push(...o.plugins);
    });
  });

  return all;
}

export function getPlugins(api: OpenApi3Spec): Plugins {
  let _iterator = 0;
  const increment = (): number => _iterator++;

  const servers = getServers(api);

  // if no global servers
  if (servers.length === 0) {
    throw new Error('Failed to generate spec: no servers defined in spec.');
  }

  const paths = getPaths(api);

  return {
    global: getGlobalPlugins(api, increment),
    servers: getServerPlugins(servers, increment),
    paths: getPathPlugins(paths, increment, api),
  };
}

// NOTE: It isn't great that we're relying on declarative-config stuff here but there's
// not much we can do about it. If we end up needing this again, it should be factored
// out to a higher-level.
export function mapDcPluginsToK8Plugins(
  dcPlugins: Array<DCPlugin>,
  suffix: string,
  increment: IndexIncrement,
): Array<KubernetesPluginConfig> {
  return dcPlugins.map(dcPlugin => {
    const k8sPlugin: KubernetesPluginConfig = {
      apiVersion: 'configuration.konghq.com/v1',
      kind: 'KongPlugin',
      metadata: {
        name: `add-${dcPlugin.name}-${suffix}${increment()}`,
      },
      plugin: dcPlugin.name,
    };

    if (dcPlugin.config) {
      k8sPlugin.config = dcPlugin.config;
    }

    return k8sPlugin;
  });
}

export function getGlobalPlugins(
  api: OpenApi3Spec,
  increment: IndexIncrement,
): Array<KubernetesPluginConfig> {
  const pluginNameSuffix = PluginNameSuffix.global;
  const globalK8Plugins = generateK8PluginConfig(api, pluginNameSuffix, increment);
  const securityPlugins = mapDcPluginsToK8Plugins(
    generateSecurityPlugins(null, api),
    pluginNameSuffix,
    increment,
  );

  return [...globalK8Plugins, ...securityPlugins];
}

export function getServerPlugins(
  servers: Array<OA3Server>,
  increment: IndexIncrement,
): ServerPlugins {
  return servers.map(server => ({
    server,
    plugins: generateK8PluginConfig(server, PluginNameSuffix.server, increment),
  }));
}

export function getPathPlugins(
  paths: OA3Paths,
  increment: IndexIncrement,
  api: OpenApi3Spec,
): PathPlugins {
  const pathPlugins = Object.keys(paths).map(path => {
    const pathItem = paths[path];

    return {
      path,
      plugins: generateK8PluginConfig(pathItem, PluginNameSuffix.path, increment),
      operations: normalizeOperationPlugins(getOperationPlugins(pathItem, increment, api)),
    };
  });

  return normalizePathPlugins(pathPlugins);
}

export function getOperationPlugins(
  pathItem: OA3PathItem,
  increment: IndexIncrement,
  api: OpenApi3Spec,
): OperationPlugins {
  const operationPlugins = Object.keys(pathItem)
    .filter(isHttpMethodKey)
    .map(key => {
      // We know this will always, only be OA3Operation (because of the filter above), but Flow doesn't know that...
      const operation: Object = pathItem[key];

      const pluginNameSuffix = PluginNameSuffix.operation;
      const opPlugins = generateK8PluginConfig(operation, pluginNameSuffix, increment);
      const securityPlugins = mapDcPluginsToK8Plugins(
        generateSecurityPlugins(operation, api),
        pluginNameSuffix,
        increment,
      );

      return {
        method: key,
        plugins: [...opPlugins, ...securityPlugins],
      };
    });
  return normalizeOperationPlugins(operationPlugins);
}

// When a plugin name is generated during parsing, we suffix it with where it was sourced from and an index.
// For example, the third plugin parsed may be on the path, so it would have the (zero-indexed) name add-key-auth-p2
const PluginNameSuffix = {
  global: 'g',
  server: 's',
  path: 'p',
  operation: 'm',
};

type PluginNameSuffixKeys = $Values<typeof PluginNameSuffix>;

export function generateK8PluginConfig(
  obj: Object,
  pluginNameSuffix: PluginNameSuffixKeys,
  increment: IndexIncrement,
): Array<KubernetesPluginConfig> {
  const plugins: Array<KubernetesPluginConfig> = [];

  for (const key of Object.keys(obj).filter(isPluginKey)) {
    const pData = obj[key];
    const name = pData.name || getPluginNameFromKey(key);

    const p: KubernetesPluginConfig = {
      apiVersion: 'configuration.konghq.com/v1',
      kind: 'KongPlugin',
      metadata: {
        name: `add-${name}-${pluginNameSuffix}${increment()}`,
      },
      plugin: name,
    };

    if (pData.config) {
      p.config = pData.config;
    }

    plugins.push(p);
  }

  return plugins;
}

const blankOperation = { method: null, plugins: [] };
const blankPath = { path: '', plugins: [], operations: [blankOperation] };

export function normalizePathPlugins(pathPlugins: PathPlugins): PathPlugins {
  const pluginsExist = pathPlugins.some(
    p => p.plugins.length || p.operations.some(o => o.plugins.length),
  );
  return pluginsExist ? pathPlugins : [blankPath];
}

export function normalizeOperationPlugins(operationPlugins: OperationPlugins): OperationPlugins {
  const pluginsExist = operationPlugins.some(o => o.plugins.length);
  return pluginsExist ? operationPlugins : [blankOperation];
}

export function prioritizePlugins(
  global: Array<KubernetesPluginConfig>,
  server: Array<KubernetesPluginConfig>,
  path: Array<KubernetesPluginConfig>,
  operation: Array<KubernetesPluginConfig>,
): Array<KubernetesPluginConfig> {
  // Order in priority: operation > path > server > global
  const plugins: Array<KubernetesPluginConfig> = [...operation, ...path, ...server, ...global];

  // Select first of each type of plugin
  return distinctByProperty(plugins, p => p.plugin);
}

export function distinctByProperty<T>(arr: Array<T>, propertySelector: (item: T) => any): Array<T> {
  const result: Array<T> = [];
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
