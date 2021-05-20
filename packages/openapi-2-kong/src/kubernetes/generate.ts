import { getMethodAnnotationName, getName, HttpMethodType, parseUrl } from '../common';
import urlJoin from 'url-join';
import { flattenPluginDocuments, getPlugins, prioritizePlugins } from './plugins';
import { pathVariablesToWildcard, resolveUrlVariables } from './variables';
import { IndexIncrement } from '../types/k8splugins';
import { K8sIngress, K8sKongIngress, K8sMetadata, K8sAnnotations, K8sIngressRule, K8sHTTPIngressPath } from '../types/kubernetes-config';
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

  // Iterate all global servers
  plugins.servers.forEach((sp, serverIndex) => {
    // Iterate all paths
    plugins.paths.forEach(pp => {
      // Iterate methods
      pp.operations.forEach(o => {
        // Prioritize plugins for doc
        const pluginsForDoc = prioritizePlugins(plugins.global, sp.plugins, pp.plugins, o.plugins);
        // Identify custom annotations
        const annotations: CustomAnnotations = {
          pluginNames: pluginsForDoc.map(x => x.metadata.name),
        };
        const method = o.method;

        if (method) {
          annotations.overrideName = getMethodAnnotationName(method);
          methodsThatNeedKongIngressDocuments.add(method);
        }

        // Create metadata
        const metadata = generateMetadata(api, annotations, increment, specName);
        // Generate Kong ingress document for a server and path in the doc
        const doc: K8sIngress = {
          apiVersion: 'extensions/v1beta1',
          kind: 'Ingress',
          metadata,
          spec: {
            rules: [
              generateRulesForServer(serverIndex, sp.server, specName, [pp.path]),
            ],
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

  const documents = [...methodDocuments, ...pluginDocuments, ...ingressDocuments];

  const result: KongForKubernetesResult = {
    type: 'kong-for-kubernetes',
    label: 'Kong for Kubernetes',
    documents,
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

export const generateRulesForServer = (
  index: number,
  server: OA3Server,
  specName: string,
  paths?: string[],
) => {
  // Resolve serverUrl variables and update the source object so it only needs to be done once per server loop.
  server.url = resolveUrlVariables(server.url, server.variables);
  const { hostname, pathname } = parseUrl(server.url);
  const serviceName = generateServiceName(server, specName, index);
  const servicePort = generateServicePort(server);
  const backend = {
    serviceName,
    servicePort,
  };
  const pathsToUse: string[] = (paths?.length && paths) || ['']; // Make flow happy

  const k8sPaths = pathsToUse.map(pathToUse => {
    const path = pathname ? generateServicePath(pathname, pathToUse) : null;
    const ingressPath: K8sHTTPIngressPath = {
      backend,
      ...(path ? { path } : {}),
    };
    return ingressPath;
  });
  const tlsConfig = generateTlsConfig(server);

  if (tlsConfig) {
    return {
      host: hostname,
      tls: {
        paths: k8sPaths,
        ...tlsConfig,
      },
    };
  }

  const k8sIngressRule: K8sIngressRule = {
    host: hostname,
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

export const generateTlsConfig = (server: OA3Server) => server['x-kubernetes-tls'] || null;

export const generateServicePort = (server: OA3Server) => {
  // x-kubernetes-backend.servicePort
  const backend = server['x-kubernetes-backend'];

  if (backend && typeof backend.servicePort === 'number') {
    return backend.servicePort;
  }

  const ports = server['x-kubernetes-service']?.spec?.ports || [];
  const firstPort = ports[0]?.port;

  // Return 443
  if (generateTlsConfig(server)) {
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
