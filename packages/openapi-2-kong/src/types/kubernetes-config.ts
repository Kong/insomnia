import { HttpMethodType } from '../common';

export interface K8sAnnotations {
  'kubernetes.io/ingress.class': 'kong';
  [key: string]: string;
}

export interface K8sMetadata {
  name: string;
  annotations: K8sAnnotations;
}

export interface K8sBackend {
  serviceName: string;
  servicePort: number;
}

export interface K8sPath {
  path?: string;
  backend: K8sBackend;
}

export interface K8sIngressRule {
  host: string;
  tls?: {
    paths: K8sPath[];
    tls?: {
      secretName: string;
    };
  };
  http?: {
    paths: K8sPath[];
  };
}

export interface K8sSpec {
  rules: K8sIngressRule[];
}

export interface KubernetesMethodConfig {
  apiVersion: 'configuration.konghq.com/v1';
  kind: 'KongIngress';
  metadata: {
    name: string;
  };
  route: {
    methods: HttpMethodType[];
  };
}

export interface KubernetesPluginConfig {
  apiVersion: 'configuration.konghq.com/v1';
  kind: 'KongPlugin';
  metadata: {
    name: string;
    global?: boolean;
  };
  config?: Record<string, any>;
  plugin: string;
}

export interface KubernetesConfig {
  apiVersion: 'extensions/v1beta1';
  kind: 'Ingress';
  metadata: K8sMetadata;
  spec: K8sSpec;
}
