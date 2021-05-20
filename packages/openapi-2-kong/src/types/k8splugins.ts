import { HttpMethodType } from '../common';
import { K8sPluginConfig } from './kubernetes-config';
import { OA3Server } from './openapi3';

export interface OperationPlugin {
  method?: HttpMethodType | null;
  plugins: K8sPluginConfig[];
}

export interface PathPlugin {
  path: string;
  plugins: K8sPluginConfig[];
  operations: OperationPlugin[];
}

export interface ServerPlugin {
  server: OA3Server;
  plugins: K8sPluginConfig[];
}

export interface Plugins {
  global: K8sPluginConfig[];
  servers: ServerPlugin[];
  paths: PathPlugin[];
}

export type IndexIncrement = () => number;
