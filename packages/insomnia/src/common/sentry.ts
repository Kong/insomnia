import type { ElectronOptions } from '@sentry/electron';

import { getAppEnvironment, getAppVersion } from './constants';

export const SENTRY_OPTIONS: Partial<ElectronOptions> = {
  dsn: 'https://aaec2e800e644070a8daba5b7ad02c16@o1147619.ingest.sentry.io/6311804',
  environment: getAppEnvironment(),
  release: getAppVersion(),
};
