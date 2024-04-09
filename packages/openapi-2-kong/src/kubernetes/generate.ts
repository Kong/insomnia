import { getMethodAnnotationName, getName, HttpMethodType, parseUrl } from '../common';
import { IndexIncrement } from '../types/k8s-plugins';
import { K8sAnnotations, K8sHTTPIngressPath, K8sIngress, K8sIngressBackend, K8sIngressRule, K8sKongIngress, K8sMetadata } from '../types/kubernetes-config';
import { OA3Server, OpenApi3Spec } from '../types/openapi3';
import { KongForKubernetesResult } from '../types/outputs';
import { flattenPluginDocuments, getPlugins, prioritizePlugins } from './plugins';
import { pathVariablesToWildcard, resolveUrlVariables } from './variables';

interface CustomAnnotations {
  pluginNames: string[];
  overrideName?: string;
}

export const generateKongForKubernetesConfigFromSpec = (api: OpenApi3Spec, legacy: Boolean = true) => {
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
        const rule = generateIngressRule(serverIndex, serverPlugin.server, specName, [pathPlugin.path], legacy);

        const doc: K8sIngress = {
          apiVersion: 'networking.k8s.io/v1',
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
      ...coreAnnotations,
      ...originalAnnotations,
      ...customAnnotations,
    };
  }

  return coreAnnotations;
};

export const generateIngressRule = (
  index: number,
  server: OA3Server,
  specName: string,
  paths?: string[],
  legacy: Boolean = true
) => {
  // Resolve serverUrl variables and update the source object so it only needs to be done once per server loop.
  server.url = resolveUrlVariables(server.url, server.variables);
  const { hostname, pathname } = parseUrl(server.url);
  const pathsToUse = paths?.length ? paths : [''];
  const backend: K8sIngressBackend = {
    service:{
      name: generateServiceName(server, specName, index),
      port: {
        number: generateServicePort(server),
      },
    },
  };

  const k8sPaths = pathsToUse.map((pathToUse): K8sHTTPIngressPath => {
    const path = pathname === null ? null : generateServicePath(pathname, pathToUse, legacy);
    return {
      backend,
      ...(path ? { path } : {}),
      pathType: 'ImplementationSpecific',
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
    throw new Error('x-kubernetes-tls must be an array of IngressTLS, matching the kubernetes IngressSpec resource. see https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#ingressspec-v1-networking-k8s-io');
  }

  return tls;
};

export const generateServicePort = (server: OA3Server) => {
  // x-kubernetes-backend.servicePort
  const backend = server['x-kubernetes-backend'];

  if (backend && typeof backend.servicePort === 'number') {
    return backend.servicePort;
  }

  const ports: { port: number }[] = server['x-kubernetes-service']?.spec?.ports || [];
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

export const generateServicePath = (serverBasePath: string, specificPath = '', legacy: Boolean = true) => {
  const shouldExtractPath = specificPath || (serverBasePath && serverBasePath !== '/');

  if (!shouldExtractPath) {
    return undefined;
  }

  const fullPath = normalize(serverBasePath, specificPath, specificPath ? '' : '.*');
  const pathname = pathVariablesToWildcard(fullPath);

  // prepend with /~ if non legacy, e.g. kong 3.0+
  if (!legacy) {
    return '/~' + pathname;
  }
  return pathname;
};

function normalize(...strArray: string[]) {
  const resultArray = [];
  if (strArray.length === 0) {
    return '';
  }

  if (typeof strArray[0] !== 'string') {
    throw new TypeError('Url must be a string. Received ' + strArray[0]);
  }

  // If the first part is a plain protocol, we combine it with the next part.
  if (strArray[0].match(/^[^/:]+:\/*$/) && strArray.length > 1) {
    const first = strArray.shift();
    strArray[0] = first + strArray[0];
  }

  // There must be two or three slashes in the file protocol, two slashes in anything else.
  if (strArray[0].match(/^file:\/\/\//)) {
    strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1:///');
  } else {
    strArray[0] = strArray[0].replace(/^([^/:]+):\/*/, '$1://');
  }

  for (let i = 0; i < strArray.length; i++) {
    let component = strArray[i];

    if (typeof component !== 'string') {
      throw new TypeError('Url must be a string. Received ' + component);
    }

    if (component === '') {
      continue;
    }

    if (i > 0) {
      // Removing the starting slashes for each component but the first.
      component = component.replace(/^[\/]+/, '');
    }
    if (i < strArray.length - 1) {
      // Removing the ending slashes for each component but the last.
      component = component.replace(/[\/]+$/, '');
    } else {
      // For the last component we will combine multiple slashes to a single one.
      component = component.replace(/[\/]+$/, '/');
    }

    resultArray.push(component);

  }

  let str = resultArray.join('/');
  // Each input component is now separated by a single slash except the possible first plain protocol part.

  // remove trailing slash before parameters or hash
  str = str.replace(/\/(\?|&|#[^!])/g, '$1');

  // replace ? in parameters with &
  const parts = str.split('?');
  str = parts.shift() + (parts.length > 0 ? '?' : '') + parts.join('&');

  return str;
}
