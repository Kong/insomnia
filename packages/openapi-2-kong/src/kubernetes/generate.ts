import { getMethodAnnotationName, getName, HttpMethodType, parseUrl } from '../common';
import urlJoin from 'url-join';
import { flattenPluginDocuments, getPlugins, prioritizePlugins } from './plugins';
import { pathVariablesToWildcard, resolveUrlVariables } from './variables';
import { IndexIncrement } from '../types/k8s-plugins';
import { K8sIngress, K8sKongIngress, K8sMetadata, K8sAnnotations, K8sIngressRule, K8sHTTPIngressPath, K8sIngressBackend } from '../types/kubernetes-config';
import { OpenApi3Spec, OA3Server } from '../types/openapi3';
import { KongForKubernetesResult } from '../types/outputs';

interface CustomAnnotations {
  pluginNames: string[];
  overrideName?: string;
}

export const generateKongForKubernetesConfigFromSpec = (api: OpenApi3Spec) => {
  const specName = getSpecName(api);

  // Extract global, server, and path plugins upfront
  const plugins = getPlugins(api);

  // Initialize document collections
  const ingressDocuments: K8sIngress[] = [];
  const methodsThatNeedKongIngressDocuments = new Set<HttpMethodType>();
  let _iterator = 0;
  const increment = (): number => _iterator++;
  plugins.servers.forEach((serverPlugin, serverIndex) => {
    plugins.paths.forEach(pathPlugin => {
      pathPlugin.operations.forEach(operation => {
        // Prioritize plugins for doc
        const pluginsForDoc = prioritizePlugins(
          plugins.global,
          serverPlugin.plugins,
          pathPlugin.plugins,
          operation.plugins,
        );

        // Identify custom annotations
        const annotations: CustomAnnotations = {
          pluginNames: pluginsForDoc.map(plugin => plugin.metadata.name),
        };
        const { method } = operation;

        if (method) {
          annotations.overrideName = getMethodAnnotationName(method);
          methodsThatNeedKongIngressDocuments.add(method);
        }

        const metadata = generateMetadata(api, annotations, increment, specName);
        const tls = generateTLS(serverPlugin.server);
        const rule = generateIngressRule(serverIndex, serverPlugin.server, specName, [pathPlugin.path]);

        const doc: K8sIngress = {
          apiVersion: 'extensions/v1beta1',
          kind: 'Ingress',
          metadata,
          spec: {
            ...(tls ? { tls } : {}),
            rules: [rule],
          },
        };
        ingressDocuments.push(doc);
      });
    });
  });

  const methodDocuments = Array.from(methodsThatNeedKongIngressDocuments).map(
    generateK8sMethodDocuments,
  );

  const pluginDocuments = flattenPluginDocuments(plugins);

  const result: KongForKubernetesResult = {
    type: 'kong-for-kubernetes',
    label: 'Kong for Kubernetes',
    documents: [
      ...methodDocuments,
      ...pluginDocuments,
      ...ingressDocuments,
    ],
    warnings: [],
  };
  return result;
};

const generateK8sMethodDocuments = (method: HttpMethodType): K8sKongIngress => ({
  apiVersion: 'configuration.konghq.com/v1',
  kind: 'KongIngress',
  metadata: {
    name: getMethodAnnotationName(method),
  },
  route: {
    methods: [method],
  },
});

const generateMetadata = (
  api: OpenApi3Spec,
  customAnnotations: CustomAnnotations,
  increment: IndexIncrement,
  specName: string,
): K8sMetadata => ({
  name: `${specName}-${increment()}`,
  annotations: generateMetadataAnnotations(api, customAnnotations),
});

export const getSpecName = (api: OpenApi3Spec) => getName(
  api,
  'openapi',
  {
    lower: true,
    replacement: '-',
  },
  true,
);

export const generateMetadataAnnotations = (
  api: OpenApi3Spec,
  { pluginNames, overrideName }: CustomAnnotations,
) => {
  // This annotation is required by kong-ingress-controller
  // https://github.com/Kong/kubernetes-ingress-controller/blob/main/docs/references/annotations.md#kubernetesioingressclass
  const coreAnnotations: K8sAnnotations = {
    'kubernetes.io/ingress.class': 'kong',
  };
  const metadata = api.info?.['x-kubernetes-ingress-metadata'];

  // Only continue if metadata annotations, or plugins, or overrides exist
  if (metadata?.annotations || pluginNames.length || overrideName) {
    const customAnnotations: K8sAnnotations = {};

    if (pluginNames.length) {
      customAnnotations['konghq.com/plugins'] = pluginNames.join(', ');
    }

    if (overrideName) {
      customAnnotations['konghq.com/override'] = overrideName;
    }

    const originalAnnotations = metadata?.annotations || {};
    return {
      ...originalAnnotations,
      ...customAnnotations,
      ...coreAnnotations,
    };
  }

  return coreAnnotations;
};

export const generateIngressRule = (
  index: number,
  server: OA3Server,
  specName: string,
  paths?: string[],
) => {
  // Resolve serverUrl variables and update the source object so it only needs to be done once per server loop.
  server.url = resolveUrlVariables(server.url, server.variables);
  const { hostname, pathname } = parseUrl(server.url);
  const pathsToUse = paths?.length ? paths : [''];
  const backend: K8sIngressBackend = {
    serviceName: generateServiceName(server, specName, index),
    servicePort: generateServicePort(server),
  };

  const k8sPaths = pathsToUse.map((pathToUse): K8sHTTPIngressPath => {
    const path = pathname === null ? null : generateServicePath(pathname, pathToUse);
    return {
      backend,
      ...(path ? { path } : {}),
    };
  });

  const k8sIngressRule: K8sIngressRule = {
    ...(hostname ? { host: hostname } : {}),
    http: {
      paths: k8sPaths,
    },
  };
  return k8sIngressRule;
};

export const generateServiceName = (
  server: OA3Server,
  specName: string,
  index: number,
) => {
  const serviceName = server['x-kubernetes-backend']?.serviceName;

  if (serviceName) {
    return serviceName;
  }

  const metadataName = server['x-kubernetes-service']?.metadata?.name;
  if (metadataName) {
    return metadataName;
  }

  // <ingress-name>-service-<server index>
  return `${specName}-service-${index}`;
};

export const generateTLS = (server?: OA3Server) => {
  if (!server) {
    return null;
  }

  const tls = server['x-kubernetes-tls'];
  if (!tls) {
    return null;
  }

  if (!Array.isArray(tls)) {
    throw new Error('x-kubernetes-tls must be an array of IngressTLS, matching the kubernetes IngressSpec resource. see https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.21/#ingressspec-v1beta1-extensions');
  }

  return tls;
};

export const generateServicePort = (server: OA3Server) => {
  // x-kubernetes-backend.servicePort
  const backend = server['x-kubernetes-backend'];

  if (backend && typeof backend.servicePort === 'number') {
    return backend.servicePort;
  }

  const ports = server['x-kubernetes-service']?.spec?.ports || [];
  const firstPort = ports[0]?.port;

  // Return 443
  if (generateTLS(server)) {
    if (ports.find(p => p.port === 443)) {
      return 443;
    }

    return firstPort || 443;
  }

  return firstPort || 80;
};

export const generateServicePath = (serverBasePath: string, specificPath = '') => {
  const shouldExtractPath = specificPath || (serverBasePath && serverBasePath !== '/');

  if (!shouldExtractPath) {
    return undefined;
  }

  const fullPath = urlJoin(serverBasePath, specificPath, specificPath ? '' : '.*');
  const pathname = pathVariablesToWildcard(fullPath);
  return pathname;
};
