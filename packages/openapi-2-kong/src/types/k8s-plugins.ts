import { HttpMethodType } from '../common';
import { K8sKongPlugin } from './kubernetes-config';
import { OA3Server } from './openapi3';

export interface OperationPlugin {
  method?: HttpMethodType | null;
  plugins: K8sKongPlugin[];
}

export interface PathPlugin {
  path: string;
  plugins: K8sKongPlugin[];
  operations: OperationPlugin[];
}

export interface ServerPlugin {
  server: OA3Server;
  plugins: K8sKongPlugin[];
}

export interface Plugins {
  global: K8sKongPlugin[];
  servers: ServerPlugin[];
  paths: PathPlugin[];
}

export type IndexIncrement = () => number;
