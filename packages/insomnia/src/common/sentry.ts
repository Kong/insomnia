import type { ElectronOptions } from '@sentry/electron';

import { getAppEnvironment, getAppVersion, getSentryDsn } from './constants';

export const SENTRY_OPTIONS: Partial<ElectronOptions> = {
  dsn: getSentryDsn(),
  environment: getAppEnvironment(),
  release: getAppVersion(),
};
