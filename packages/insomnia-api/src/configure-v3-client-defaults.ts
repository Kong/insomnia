import { generateRequestId, getApiBaseURL, getClientString } from './client-defaults';
import { proxyAwareFetch } from './insomnia-fetch';
import { configureV3Client } from './spaces';

export const configureV3ClientDefaults = () =>
  configureV3Client({
    getBaseURL: getApiBaseURL,
    getClientString,
    generateRequestId: () => generateRequestId('desk'),
    fetchApi: proxyAwareFetch,
  });
