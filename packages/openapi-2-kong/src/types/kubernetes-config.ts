import { HttpMethodType } from '../common';
import { Plugin, PluginBase } from './kong';

export interface K8sIngressClassAnnotation {
  'kubernetes.io/ingress.class'?: 'kong';
}

export interface K8sPluginsAnnotation {
  'konghq.com/plugins'?: string;
}

export interface K8sOverrideAnnotation {
  'konghq.com/override'?: string;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#objectmeta-v1-meta then look at `annotations`. */
export type K8sAnnotations =
  & K8sIngressClassAnnotation
  & K8sOverrideAnnotation
  & K8sPluginsAnnotation
  & Record<string, string>
  ;

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#objectmeta-v1-meta */
export interface K8sMetadata {
  /** The unique-per-instance name used by kubernetes to track individual Kubernetes resources */
  name: string;
  annotations?: K8sAnnotations;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#ingressbackend-v1-networking-k8s-io */
export interface K8sIngressBackend {
  service: K8sIngressServiceBackend;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#ingressservicebackend-v1-networking-k8s-io */
export interface K8sIngressServiceBackend {
  name: string;
  port: K8sServiceBackendPort;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#servicebackendport-v1-networking-k8s-io */
export interface K8sServiceBackendPort {
  name?: string;
  number: number;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#httpingresspath-v1-networking-k8s-io */
export interface K8sHTTPIngressPath {
  path?: string;
  backend: K8sIngressBackend;
  pathType: string;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#httpingressrulevalue-v1-networking-k8s-io */
export interface K8sHTTPIngressRuleValue {
  paths: K8sHTTPIngressPath[];
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#ingressrule-v1-networking-k8s-io */
export interface K8sIngressRule {
  host?: string;
  http?: K8sHTTPIngressRuleValue;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#ingresstls-v1-networking-k8s-io */
export interface K8sIngressTLS {
  hosts?: string[];
  secretName: string;
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#ingressspec-v1-networking-k8s-io */
export interface K8sIngressSpec {
  defaultBackend?: K8sIngressBackend;
  rules: K8sIngressRule[];
  tls?: K8sIngressTLS[];
}

export interface KubernetesResource {
  apiVersion: string;
  kind: string;
  metadata: K8sMetadata;
}

/** see: https://docs.konghq.com/kubernetes-ingress-controller/1.2.x/concepts/custom-resources/#kongingress */
export interface K8sKongIngress extends KubernetesResource {
  apiVersion: 'configuration.konghq.com/v1';
  kind: 'KongIngress';
  route: {
    methods: (HttpMethodType | Lowercase<HttpMethodType>)[];
  };
}

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#ingress-v1-networking-k8s-io */
export interface K8sIngress extends KubernetesResource {
  apiVersion: 'networking.k8s.io/v1';
  kind: 'Ingress';
  spec: K8sIngressSpec;
}

/** see: https://docs.konghq.com/kubernetes-ingress-controller/1.2.x/concepts/custom-resources/#kongplugin */
export interface K8sKongPluginBase<Plugin extends PluginBase<string>> extends KubernetesResource {
  apiVersion: 'configuration.konghq.com/v1';
  kind: 'KongPlugin';
  metadata: K8sMetadata & {
    global?: boolean;
  };
  config?: Plugin['config'];
  plugin: Plugin['name'];
}

export type K8sKongPlugin = K8sKongPluginBase<Plugin>;

export type K8sManifest =
  | K8sIngress
  | K8sKongIngress
  | K8sKongPlugin
  ;
