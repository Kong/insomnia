import type { ClientOptions } from '@sentry/types';

import { getAppEnvironment, getAppVersion, getSentryDsn } from './constants';

export const SENTRY_OPTIONS: Partial<ClientOptions> = {
  sampleRate: 0.5,
  dsn: getSentryDsn(),
  environment: getAppEnvironment(),
  release: getAppVersion(),
};

export const enum SentryMetrics {
  APP_START_DURATION = 'app_start_duration',
};

export const enum LandingPage {
  Project = 'project',
}
