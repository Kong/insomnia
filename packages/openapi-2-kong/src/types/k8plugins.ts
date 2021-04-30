import { KubernetesPluginConfig } from './kubernetes-config';
import { HttpMethodType, OA3Server } from './openapi3';

export type OperationPlugins = {
  method?: HttpMethodType | null;
  plugins: KubernetesPluginConfig[];
}[];

export type PathPlugins = {
  path: string;
  plugins: KubernetesPluginConfig[];
  operations: OperationPlugins;
}[];

export type ServerPlugins = {
  server: OA3Server;
  plugins: KubernetesPluginConfig[];
}[];

export interface Plugins {
  global: KubernetesPluginConfig[];
  servers: ServerPlugins;
  paths: PathPlugins;
}

export type IndexIncrement = () => number;
