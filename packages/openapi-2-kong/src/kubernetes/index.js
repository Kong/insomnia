// @flow

import { getName, getServers, parseUrl } from '../common';
import { generateSecurityPlugins } from '../declarative-config/security-plugins';

export function generateKongForKubernetesConfigFromSpec(
  api: OpenApi3Spec,
  tags: Array<string>,
): KongForKubernetesResult {
  const metadata = generateMetadata(api);
  const document: KubernetesConfig = {
    apiVersion: 'extensions/v1beta1',
    kind: 'Ingress',
    metadata,
    spec: { rules: generateRules(api, metadata.name) },
  };

  const otherDocuments = generatePluginDocuments(api);

  // Add Kong plugins as annotations to ingress definition
  if (otherDocuments.length) {
    const pluginNames = otherDocuments.map(d => d.metadata.name).join(', ');
    if (document.metadata.annotations) {
      document.metadata.annotations['plugins.konghq.com'] = pluginNames;
    } else {
      document.metadata.annotations = { 'plugins.konghq.com': pluginNames };
    }
  }

  const documents = [...otherDocuments, document];

  return ({
    type: 'kong-for-kubernetes',
    label: 'Kong for Kubernetes',
    documents,
    warnings: [],
  }: KongForKubernetesResult);
}

function generateMetadata(api: OpenApi3Spec): K8sMetadata {
  const metadata: K8sMetadata = {
    name: generateMetadataName(api),
  };

  const annotations = generateMetadataAnnotations(api);
  if (annotations) {
    metadata.annotations = annotations;
  }

  return metadata;
}

export function generateMetadataName(api: OpenApi3Spec): string {
  const info: Object = api.info || {};
  const metadata = info['x-kubernetes-ingress-metadata'];

  // x-kubernetes-ingress-metadata.name
  if (metadata && metadata.name) {
    return metadata.name;
  }

  return getName(api, 'openapi', { lower: true, replacement: '-' });
}

export function generateMetadataAnnotations(api: OpenApi3Spec): K8sAnnotations | null {
  const info: Object = api.info || {};
  const metadata = info['x-kubernetes-ingress-metadata'];
  if (metadata && metadata.annotations) {
    return metadata.annotations;
  }

  return null;
}

export function generateRules(api: OpenApi3Spec, ingressName: string): K8sIngressRules {
  return getServers(api).map((server, i) => {
    const { hostname } = parseUrl(server.url);
    const serviceName = generateServiceName(server, ingressName, i);
    const servicePort = generateServicePort(server);
    const backend = { serviceName, servicePort };
    const path = generateServicePath(server, backend);

    const tlsConfig = generateTlsConfig(server);
    if (tlsConfig) {
      return {
        host: hostname,
        tls: {
          paths: [path],
          ...tlsConfig,
        },
      };
    }

    return {
      host: hostname,
      http: { paths: [path] },
    };
  });
}

export function generateServiceName(server: OA3Server, ingressName: string, index: number): string {
  const backend = (server: Object)['x-kubernetes-backend'];

  // x-kubernetes-backend.serviceName
  if (backend && backend.serviceName) {
    return backend.serviceName;
  }

  // x-kubernetes-service.metadata.name
  const service = (server: Object)['x-kubernetes-service'];
  if (service && service.metadata && service.metadata.name) {
    return service.metadata.name;
  }

  // <ingress-name>-s<server index>
  return `${ingressName}-s${index}`;
}

export function generateTlsConfig(server: OA3Server): Object | null {
  const tlsConfig = (server: Object)['x-kubernetes-tls'];
  return tlsConfig || null;
}

export function generateServicePort(server: OA3Server): number {
  // x-kubernetes-backend.servicePort
  const backend = (server: Object)['x-kubernetes-backend'];
  if (backend && typeof backend.servicePort === 'number') {
    return backend.servicePort;
  }

  const service = (server: Object)['x-kubernetes-service'] || {};
  const spec = service.spec || {};
  const ports = spec.ports || [];

  // TLS configured
  const tlsConfig = generateTlsConfig(server);
  if (tlsConfig) {
    if (ports.find(p => p.port === 443)) {
      return 443;
    }

    if (ports[0] && ports[0].port) {
      return ports[0].port;
    }

    return 443;
  }

  // x-kubernetes-service.spec.ports.0.port
  if (ports[0] && ports[0].port) {
    return ports[0].port;
  }

  return 80;
}

export function generateServicePath(server: OA3Server, backend: K8sBackend): K8sPath {
  const { pathname } = parseUrl(server.url);
  const p: K8sPath = {
    backend,
  };

  if (!pathname || pathname === '/') {
    return p;
  }

  if (pathname.match(/\/$/)) {
    p.path = pathname + '.*';
  } else {
    p.path = pathname + '/.*';
  }

  return p;
}

export function generatePluginDocuments(api: OpenApi3Spec): Array<KubernetesPluginConfig> {
  const plugins = [];
  for (const key of Object.keys(api)) {
    if (key.indexOf('x-kong-plugin-') !== 0) {
      continue;
    }
    const nameFromKey = key.replace('x-kong-plugin-', '');
    const pData: Object = api[key];
    const p: KubernetesPluginConfig = {
      apiVersion: 'configuration.konghq.com/v1',
      kind: 'KongPlugin',
      metadata: {
        name: `add-${pData.name || nameFromKey}`,
      },
      plugin: pData.name || key.replace('x-kong-plugin-', ''),
    };

    if (pData.config) {
      p.config = pData.config;
    }

    plugins.push(p);
  }

  // NOTE: It isn't great that we're relying on declarative-config stuff here but there's
  // not much we can do about it. If we end up needing this again, it should be factored
  // out to a higher-level.
  const securityPlugins = generateSecurityPlugins(null, api).map(dcPlugin => {
    const k8sPlugin: KubernetesPluginConfig = {
      apiVersion: 'configuration.konghq.com/v1',
      kind: 'KongPlugin',
      metadata: {
        name: `add-${dcPlugin.name}`,
      },
      plugin: dcPlugin.name,
    };

    if (dcPlugin.config) {
      k8sPlugin.config = dcPlugin.config;
    }

    return k8sPlugin;
  });

  return [...plugins, ...securityPlugins];
}
