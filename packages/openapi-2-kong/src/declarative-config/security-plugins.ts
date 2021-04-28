import { getSecurity } from '../common';
import { DCPlugin } from '../types/declarative-config';
import { OA3Operation, OpenApi3Spec, OA3SecurityScheme, OA3SecuritySchemeApiKey, OA3SecuritySchemeHttp, OA3SecuritySchemeOpenIdConnect } from '../types/openapi3';

export function generateSecurityPlugins(
  op: OA3Operation | null,
  api: OpenApi3Spec,
  tags: string[],
): DCPlugin[] {
  const plugins = [];
  const components = api.components || {};
  const securitySchemes = components.securitySchemes || {};
  const security = op ? getSecurity(op) : getSecurity(api);

  for (const securityItem of security || []) {
    for (const name of Object.keys(securityItem)) {
      const scheme = (securitySchemes[name] || {}) as OA3SecurityScheme;
      const args = securityItem[name];
      const plugin = generateSecurityPlugin(scheme, args, tags);

      if (plugin) {
        plugins.push(plugin);
      }
    }
  }

  return plugins;
}

export function generateApiKeySecurityPlugin(scheme: OA3SecuritySchemeApiKey): DCPlugin {
  if (!['query', 'header', 'cookie'].includes(scheme.in)) {
    throw new Error(`a ${scheme.type} object expects valid "in" property. Got ${scheme.in}`);
  }

  if (!scheme.name) {
    throw new Error(`a ${scheme.type} object expects valid "name" property. Got ${scheme.name}`);
  }

  return {
    name: 'key-auth',
    config: {
      key_names: [scheme.name],
    },
  };
}

export function generateHttpSecurityPlugin(scheme: OA3SecuritySchemeHttp): DCPlugin {
  if ((scheme.scheme || '').toLowerCase() !== 'basic') {
    throw new Error(`Only "basic" http scheme supported. got ${scheme.scheme}`);
  }

  return {
    name: 'basic-auth',
  };
}

export function generateOpenIdConnectSecurityPlugin(
  scheme: OA3SecuritySchemeOpenIdConnect,
  args: string[],
): DCPlugin {
  if (!scheme.openIdConnectUrl) {
    throw new Error(`invalid "openIdConnectUrl" property. Got ${scheme.openIdConnectUrl}`);
  }

  return {
    name: 'openid-connect',
    config: {
      issuer: scheme.openIdConnectUrl,
      scopes_required: args || [],
    },
  };
}

export function generateOAuth2SecurityPlugin(): DCPlugin {
  return {
    config: {
      auth_methods: ['client_credentials'],
    },
    name: 'openid-connect',
  };
}

export function generateSecurityPlugin(
  scheme: OA3SecurityScheme | null,
  args: string[],
  tags: string[],
): DCPlugin | null {
  let plugin: DCPlugin | null = null;

  // Generate base plugin
  switch (scheme.type) {
    case 'apiKey':
      plugin = generateApiKeySecurityPlugin(scheme);
      break;

    case 'http':
      plugin = generateHttpSecurityPlugin(scheme);
      break;

    case 'openIdConnect':
      plugin = generateOpenIdConnectSecurityPlugin(scheme, args);
      break;

    case 'oauth2':
      plugin = generateOAuth2SecurityPlugin();
      break;

    default:
      return null;
  }

  // Add additional plugin configuration from x-kong-security-* property
  // Only search for the matching key
  // i.e. OAuth2 security with x-kong-security-basic-auth should not match
  const kongSecurity = (scheme as Record<string, any>)[`x-kong-security-${plugin.name}`] ?? {};

  if (kongSecurity.config) {
    plugin.config = kongSecurity.config;
  }

  // Add global tags
  plugin.tags = [...tags, ...(kongSecurity.tags ?? [])];
  return plugin;
}
