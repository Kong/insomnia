import { OpenAPIV3 } from 'openapi-types';

import { getSecurity } from '../common';
import { DCPlugin } from '../types/declarative-config';
import { BasicAuthPlugin, KeyAuthPlugin, OpenIDConnectPlugin } from '../types/kong';
import { OA3Operation, OA3SecurityScheme, OpenApi3Spec } from '../types/openapi3';

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

export const generateApiKeySecurityPlugin = (scheme: OpenAPIV3.ApiKeySecurityScheme) => {
  if (!['query', 'header', 'cookie'].includes(scheme.in)) {
    throw new Error(`a ${scheme.type} object expects valid "in" property. Got ${scheme.in}`);
  }

  if (!scheme.name) {
    throw new Error(`a ${scheme.type} object expects valid "name" property. Got ${scheme.name}`);
  }
  const keyAuthPlugin: KeyAuthPlugin = {
    name: 'key-auth',
    config: {
      key_names: [scheme.name],
    },
  };
  return keyAuthPlugin;
};

export const generateBasicAuthPlugin = (scheme: OpenAPIV3.HttpSecurityScheme) => {
  if ((scheme.scheme || '').toLowerCase() !== 'basic') {
    throw new Error(`Only "basic" http scheme supported. got ${scheme.scheme}`);
  }
  const basicAuthPlugin: BasicAuthPlugin = {
    name: 'basic-auth',
  };
  return basicAuthPlugin;
};

export const generateOpenIdConnectSecurityPlugin = (scheme: OpenAPIV3.OpenIdSecurityScheme, args: string[]) => {
  if (!scheme.openIdConnectUrl) {
    throw new Error(`invalid "openIdConnectUrl" property. Got ${scheme.openIdConnectUrl}`);
  }
  const openIdConnectPlugin: OpenIDConnectPlugin = {
    name: 'openid-connect',
    config: {
      issuer: scheme.openIdConnectUrl,
      scopes_required: args || [],
    },
  };
  return openIdConnectPlugin;
};

export function generateSecurityPlugin(
  scheme: OA3SecurityScheme | null,
  args: string[],
  tags: string[],
) {
  let plugin: DCPlugin | null = null;

  // Generate base plugin
  switch (scheme?.type.toLowerCase()) {
    case 'apikey':
      plugin = generateApiKeySecurityPlugin(scheme as OpenAPIV3.ApiKeySecurityScheme);
      break;

    case 'http':
      plugin = generateBasicAuthPlugin(scheme as OpenAPIV3.HttpSecurityScheme);
      break;

    case 'openidconnect':
      plugin = generateOpenIdConnectSecurityPlugin(scheme as OpenAPIV3.OpenIdSecurityScheme, args);
      break;

    default:
      return null;
  }

  // Add additional plugin configuration from x-kong-security-* property
  // Only search for the matching key
  // i.e. OAuth2 security with x-kong-security-basic-auth should not match
  const kongSecurity = (scheme as Record<string, any>)[`x-kong-security-${plugin.name}`] ?? {};

  if (kongSecurity.config) {
    plugin.config = {
      ...plugin.config,
      ...kongSecurity.config,
    };
  }

  // Add global tags
  plugin.tags = [
    ...tags,
    ...(kongSecurity.tags ?? []),
  ];
  return plugin;
}
