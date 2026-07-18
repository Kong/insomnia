import { configureV3Client } from 'insomnia-api';

import { getApiBaseURL, getClientString } from './constants';
import { proxyAwareFetch } from './insomnia-fetch';
import { generateId } from './misc';

/**
 * Wires the v3 API client with the standard desktop/CLI configuration. The inputs are identical
 * across every entrypoint (renderer, main, CLI), so this lives in one place to keep the request-id
 * prefix and base-URL wiring from drifting between them. Unlike `configureFetch`, which injects
 * entrypoint-specific behaviour (e.g. deep-link handling) and is wired inline per entrypoint.
 */
export const configureV3ClientDefaults = () =>
  configureV3Client({
    getBaseURL: getApiBaseURL,
    getClientString,
    generateRequestId: () => generateId('desk'),
    // Mirrors `configureFetch` above: route SDK requests through the same proxy-aware fetch
    // (net.fetch in main) so system proxy settings work like they did before the v3 migration.
    fetchApi: proxyAwareFetch,
  });
