// @flow

import type { HttpMethodKeys } from '../src/common';

declare type OperationPlugins = Array<{
  method: ?HttpMethodKeys,
  plugins: Array<KubernetesPluginConfig>,
}>;

declare type PathPlugins = Array<{
  path: string,
  plugins: Array<KubernetesPluginConfig>,
  operations: OperationPlugins,
}>;

declare type ServerPlugins = Array<{
  server: OA3Server,
  plugins: Array<KubernetesPluginConfig>,
}>;

declare type Plugins = {
  global: Array<KubernetesPluginConfig>,
  servers: ServerPlugins,
  paths: PathPlugins,
};

declare type IndexIncrement = () => number;
