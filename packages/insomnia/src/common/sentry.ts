import type { ClientOptions } from '@sentry/types';

import { getAppEnvironment, getAppVersion, getSentryDsn } from './constants';

export const APP_START_TIME = performance.now();

export const SENTRY_OPTIONS: Partial<ClientOptions> = {
  sampleRate: 0.5,
  dsn: getSentryDsn(),
  environment: getAppEnvironment(),
  release: getAppVersion(),
};

export const enum SentryMetrics {
  APP_START_DURATION = 'app_start_duration',
  MAIN_PROCESS_START_DURATION = 'main_process_start_duration',
  ORGANIZATION_SWITCH_DURATION = 'organization_switch_duration',
  PROJECT_SWITCH_DURATION = 'project_switch_duration',
};

export const enum LandingPage {
  Project = 'project',
  Onboarding = 'onboarding',
  Login = 'login',
  Scratchpad = 'scratchpad',
}
