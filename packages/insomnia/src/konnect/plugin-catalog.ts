export interface PluginSuggestion {
  name: string;
  displayName: string;
  description: string;
}

/**
 * Curated discovery list for the request Plugins tab. The order is intentional;
 * availability is filtered per control plane using the available-plugins API.
 */
export const SUGGESTED_PLUGINS: readonly PluginSuggestion[] = [
  {
    name: 'datakit',
    displayName: 'Datakit',
    description: 'Datakit is a workflow engine for working with external APIs.',
  },
  {
    name: 'key-auth',
    displayName: 'Key Authentication',
    description: 'Add key authentication to your services',
  },
  {
    name: 'openid-connect',
    displayName: 'OpenID Connect',
    description: 'Integrate Kong with a third-party OpenID Connect 1.0 provider',
  },
  {
    name: 'cors',
    displayName: 'CORS',
    description: 'Allow developers to make requests from the browser',
  },
  {
    name: 'rate-limiting-advanced',
    displayName: 'Rate Limiting Advanced',
    description: 'Rate-limit how many HTTP requests a developer can make',
  },
  {
    name: 'request-transformer',
    displayName: 'Request Transformer',
    description: 'Modify the request before hitting the upstream server',
  },
];
