import { platform } from 'insomnia-data/common';

import { version } from '../package.json';

interface ClientEnv {
  PLAYWRIGHT_TEST: string | undefined;
  INSOMNIA_ENV: string | undefined;
  INSOMNIA_API_URL: string | undefined;
}

// Renderer reads env from the preload (`window.env`); main process, UtilityProcess and the inso
// CLI have no `window` and fall back to `process.env`.
const env: ClientEnv =
  typeof window !== 'undefined' && (window as unknown as { env?: ClientEnv }).env
    ? (window as unknown as { env: ClientEnv }).env
    : (process.env as unknown as ClientEnv);

export const PLAYWRIGHT_TEST = env.PLAYWRIGHT_TEST;

export const INSOMNIA_FETCH_TIME_OUT = 30_000;

export const getApiBaseURL = () => env.INSOMNIA_API_URL || 'https://api.insomnia.rest';

const getAppEnvironment = () => env.INSOMNIA_ENV || process.env.INSOMNIA_ENV || 'production';

// All workspace packages in this monorepo are released with the same version number.
const getAppVersion = () => version;

export const getClientString = () => `${getAppEnvironment()}::${platform}::${getAppVersion()}`;

export const generateRequestId = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
