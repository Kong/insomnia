// @flow

declare type K8sAnnotations = {|
  [string]: string,
|};

declare type K8sMetadata = {
  name: string,
  annotations?: K8sAnnotations,
};

declare type K8sBackend = {
  serviceName: string,
  servicePort: number,
}

declare type K8sPath = {
  path?: string,
  backend: K8sBackend,
}

declare type K8sIngressRule = {
  host: string,
  tls?: {paths: Array<K8sPath>, tls: {secretName: string}},
  http?: {paths: Array<K8SPath>},
};

declare type K8sIngressRules = Array<K8sIngressRule>;

declare type K8sSpec = {
  rules: K8sIngressRules,
};

declare type KubernetesConfig = {|
  apiVersion: 'extensions/v1beta1',
  kind: 'Ingress',
  metadata: K8sMetadata,
  spec: K8sSpec,
|};
