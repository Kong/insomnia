import * as Sentry from '@sentry/electron/main';

import * as session from '../account/session';
import { isDevelopment } from '../common/constants';
import { type ChangeBufferEvent, database as db } from '../common/database';
import { SENTRY_OPTIONS } from '../common/sentry';
import * as models from '../models/index';
import { isSettings } from '../models/settings';

let enabled = false;

/**
 * Watch setting for changes. This must be called after the DB is initialized.
 */
export function sentryWatchAnalyticsEnabled() {
  models.settings.get().then(async settings => {
    enabled = settings.enableAnalytics || await session.isLoggedIn();
  });

  db.onChange(async (changes: ChangeBufferEvent[]) => {
    for (const change of changes) {
      const [event, doc] = change;
      if (isSettings(doc) && event === 'update') {
        enabled = doc.enableAnalytics || await session.isLoggedIn();
      }

      if (event === 'insert' || event === 'update') {
        if ([models.workspace.type, models.project.type].includes(doc.type) && !doc.parentId) {
          Sentry.captureException(new Error(`Missing parent ID for ${doc.type} on ${event}`));
        }
      }
    }
  });
}

// some historical context:
// At beginning We are vendoring ElectronOfflineNetTransport just to be able to control whether or not sending is allowed
// https://github.com/getsentry/sentry-electron/issues/489
// After the official support. Now we could use the transportOptions.shouldSend to control whether or not sending is allowed
// https://github.com/getsentry/sentry-electron/pull/889
// docs: https://docs.sentry.io/platforms/javascript/guides/electron/
export function initializeSentry() {
  Sentry.init({
    ...SENTRY_OPTIONS,
    transportOptions: {
      /**
       * Called before we attempt to send an envelope to Sentry.
       *
       * If this function returns false, `shouldStore` will be called to determine if the envelope should be stored.
       *
       * Default: () => true
       *
       * @param envelope The envelope that will be sent.
       * @returns Whether we should attempt to send the envelope
       */
      shouldSend: () => enabled,
    },
    integrations: isDevelopment() ? [] : [
      Sentry.anrIntegration({ captureStackTrace: true }),
    ],
  });
}
