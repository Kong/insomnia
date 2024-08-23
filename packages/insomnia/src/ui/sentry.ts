import * as Sentry from '@sentry/electron/renderer';

import { SENTRY_OPTIONS } from '../common/sentry';

export function initializeSentry() {
  Sentry.init({
    ...SENTRY_OPTIONS,
    // enable sentry tracing
    integrations: [Sentry.browserTracingIntegration()],
    // set 0.1 sample rate for traces, only send 10% of traces, and check whether the limit is exceeded
    // https://konghq.sentry.io/settings/billing/overview/?category=transactions
    tracesSampleRate: 0.1,
  });
  Sentry.getCurrentScope().setUser(null);
}
