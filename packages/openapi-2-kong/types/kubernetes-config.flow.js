// @flow

declare type K8sAnnotations = {
  'kubernetes.io/ingress.class': 'kong',
  [string]: string,
};

declare type K8sMetadata = {
  name: string,
  annotations: K8sAnnotations,
};

declare type K8sBackend = {
  serviceName: string,
  servicePort: number,
};

declare type K8sPath = {
  path?: string,
  backend: K8sBackend,
};

declare type K8sIngressRule = {
  host: string,
  tls?: { paths: Array<K8sPath>, tls: { secretName: string } },
  http?: { paths: Array<K8SPath> },
};

declare type K8sIngressRules = Array<K8sIngressRule>;

declare type K8sSpec = {
  rules: K8sIngressRules,
};

declare type KubernetesMethodConfig = {
  apiVersion: 'configuration.konghq.com/v1',
  kind: 'KongIngress',
  metadata: {
    name: string,
  },
  route: {
    methods: Array<HttpMethodType>,
  },
};

declare type KubernetesPluginConfig = {
  apiVersion: 'configuration.konghq.com/v1',
  kind: 'KongPlugin',
  metadata: {
    name: string,
    global?: boolean,
  },
  config?: { [string]: any },
  plugin: string,
};

declare type KubernetesConfig = {|
  apiVersion: 'extensions/v1beta1',
  kind: 'Ingress',
  metadata: K8sMetadata,
  spec: K8sSpec,
|};
