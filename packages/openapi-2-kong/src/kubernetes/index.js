// @flow

import { getMethodAnnotationName, getName, parseUrl } from '../common';
import urlJoin from 'url-join';
import { flattenPluginDocuments, getPlugins, prioritizePlugins } from './plugins';
import { pathVariablesToWildcard, resolveUrlVariables } from './variables';

export function generateKongForKubernetesConfigFromSpec(
  api: OpenApi3Spec,
  tags: Array<string>,
): KongForKubernetesResult {
  const specName = getSpecName(api);

  // Extract global, server, and path plugins upfront
  const plugins = getPlugins(api);

  // Initialize document collections
  const ingressDocuments = [];

  const methodsThatNeedKongIngressDocuments: Set<HttpMethodType> = new Set<HttpMethodType>();
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
        const doc: KubernetesConfig = {
          apiVersion: 'extensions/v1beta1',
          kind: 'Ingress',
          metadata,
          spec: {
            rules: [generateRulesForServer(serverIndex, sp.server, specName, [pp.path])],
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

  return ({
    type: 'kong-for-kubernetes',
    label: 'Kong for Kubernetes',
    documents,
    warnings: [],
  }: KongForKubernetesResult);
}

function generateK8sMethodDocuments(method: HttpMethodType): KubernetesMethodConfig {
  return {
    apiVersion: 'configuration.konghq.com/v1',
    kind: 'KongIngress',
    metadata: {
      name: getMethodAnnotationName(method),
    },
    route: {
      methods: [method],
    },
  };
}

function generateMetadata(
  api: OpenApi3Spec,
  customAnnotations: CustomAnnotations,
  increment: IndexIncrement,
  specName: string,
): K8sMetadata {
  return {
    name: `${specName}-${increment()}`,
    annotations: generateMetadataAnnotations(api, customAnnotations),
  };
}

type CustomAnnotations = {
  pluginNames: Array<string>,
  overrideName?: string,
};

export function getSpecName(api: OpenApi3Spec): string {
  return getName(api, 'openapi', { lower: true, replacement: '-' }, true);
}

export function generateMetadataAnnotations(
  api: OpenApi3Spec,
  { pluginNames, overrideName }: CustomAnnotations,
): K8sAnnotations {
  // This annotation is required by kong-ingress-controller
  // https://github.com/Kong/kubernetes-ingress-controller/blob/main/docs/references/annotations.md#kubernetesioingressclass
  const coreAnnotations = { 'kubernetes.io/ingress.class': 'kong' };

  const metadata = api.info?.['x-kubernetes-ingress-metadata'];

  // Only continue if metadata annotations, or plugins, or overrides exist
  if (metadata?.annotations || pluginNames.length || overrideName) {
    const customAnnotations = {};

    if (pluginNames.length) {
      customAnnotations['konghq.com/plugins'] = pluginNames.join(', ');
    }

    if (overrideName) {
      customAnnotations['konghq.com/override'] = overrideName;
    }

    const originalAnnotations = metadata?.annotations || {};
    return { ...originalAnnotations, ...customAnnotations, ...coreAnnotations };
  }

  return coreAnnotations;
}

export function generateRulesForServer(
  index: number,
  server: OA3Server,
  specName: string,
  paths?: Array<string>,
): K8sIngressRule {
  // Resolve serverUrl variables and update the source object so it only needs to be done once per server loop.
  server.url = resolveUrlVariables(server.url, server.variables);

  const { hostname, pathname } = parseUrl(server.url);
  const serviceName = generateServiceName(server, specName, index);
  const servicePort = generateServicePort(server);
  const backend = { serviceName, servicePort };

  const pathsToUse: Array<string> = (paths?.length && paths) || ['']; // Make flow happy
  const k8sPaths: Array<K8sPath> = pathsToUse.map(p => {
    const path = generateServicePath(pathname, p);

    return path ? { path, backend } : { backend };
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

  return {
    host: hostname,
    http: { paths: k8sPaths },
  };
}

export function generateServiceName(server: OA3Server, specName: string, index: number): string {
  // x-kubernetes-backend.serviceName
  const serviceName = server['x-kubernetes-backend']?.serviceName;
  if (serviceName) {
    return serviceName;
  }

  // x-kubernetes-service.metadata.name
  const metadataName = server['x-kubernetes-service']?.metadata?.name;
  if (metadataName) {
    return metadataName;
  }

  // <ingress-name>-s<server index>
  return `${specName}-service-${index}`;
}

export function generateTlsConfig(server: OA3Server): Object | null {
  return server['x-kubernetes-tls'] || null;
}

export function generateServicePort(server: OA3Server): number {
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
}

export function generateServicePath(
  serverBasePath: string,
  specificPath: string = '',
): string | typeof undefined {
  const shouldExtractPath = specificPath || (serverBasePath && serverBasePath !== '/');
  if (!shouldExtractPath) {
    return undefined;
  }

  const fullPath = urlJoin(serverBasePath, specificPath, specificPath ? '' : '.*');
  const pathname = pathVariablesToWildcard(fullPath);

  return pathname;
}
