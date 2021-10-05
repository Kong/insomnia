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

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#objectmeta-v1-meta then look at `annotations`. */
export type K8sAnnotations =
  & K8sIngressClassAnnotation
  & K8sOverrideAnnotation
  & K8sPluginsAnnotation
  & Record<string, string>
  ;

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#objectmeta-v1-meta */
export interface K8sMetadata {
  /** The unique-per-instance name used by kubernetes to track individual Kubernetes resources */
  name: string;
  annotations?: K8sAnnotations;
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
  host?: string;
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

/** see: https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#ingress-v1beta1-extensions */
export interface K8sIngress extends KubernetesResource {
  apiVersion: 'extensions/v1beta1';
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
