import { HttpMethodType } from '../common';

export interface K8sIngressClassAnnotation {
  'kubernetes.io/ingress.class'?: 'kong';
}

export interface K8sPluginsAnnotation {
  'konghq.com/plugins'?: string;
}

export interface K8sOverrideAnnotation {
  'konghq.com/override'?: string;
}

export type K8sAnnotations =
  & K8sIngressClassAnnotation
  & K8sOverrideAnnotation
  & K8sPluginsAnnotation
  & Record<string, string>
  ;

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#objectmeta-v1-meta */
export interface K8sMetadata {
  name: string;
  annotations: K8sAnnotations;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#ingressbackend-v1beta1-extensions */
export interface K8sIngressBackend {
  serviceName: string;
  servicePort: number;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#httpingresspath-v1beta1-extensions */
export interface K8sHTTPIngressPath {
  path?: string;
  backend: K8sIngressBackend;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#httpingressrulevalue-v1beta1-extensions */
export interface K8sHTTPIngressRuleValue {
  paths: K8sHTTPIngressPath[];
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#ingressrule-v1beta1-extensions */
export interface K8sIngressRule {
  host: string;
  http?: K8sHTTPIngressRuleValue;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#ingresstls-v1beta1-extensions */
export interface K8sIngressTLS {
  hosts?: string[];
  secretName: string;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#ingressspec-v1beta1-extensions */
export interface K8sIngressSpec {
  backend?: K8sIngressBackend;
  rules: K8sIngressRule[];
  tls?: K8sIngressTLS[];
}

export interface K8sKongIngress {
  apiVersion: 'configuration.konghq.com/v1';
  kind: 'KongIngress';
  metadata: {
    name: string;
  };
  route: {
    methods: HttpMethodType[];
  };
}

export interface K8sKongPlugin {
  apiVersion: 'configuration.konghq.com/v1';
  kind: 'KongPlugin';
  metadata: {
    name: string;
    global?: boolean;
  };
  config?: Record<string, any>;
  plugin: string;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#ingress-v1beta1-extensions */
export interface K8sIngress {
  apiVersion: 'extensions/v1beta1';
  kind: 'Ingress';
  metadata: K8sMetadata;
  spec: K8sIngressSpec;
}

export type K8sManifest =
  | K8sIngress
  | K8sKongIngress
  | K8sKongPlugin
  ;
