import { HttpMethodType } from '../common';
import { KubernetesPluginConfig } from './kubernetes-config';
import { OA3Server } from './openapi3';

export interface OperationPlugin {
  method?: HttpMethodType | null;
  plugins: KubernetesPluginConfig[];
}

export interface PathPlugin {
  path: string;
  plugins: KubernetesPluginConfig[];
  operations: OperationPlugin[];
}

export interface ServerPlugin {
  server: OA3Server;
  plugins: KubernetesPluginConfig[];
}

export interface Plugins {
  global: KubernetesPluginConfig[];
  servers: ServerPlugin[];
  paths: PathPlugin[];
}

export type IndexIncrement = () => number;
