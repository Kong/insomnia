import * as Sentry from '@sentry/electron/main';
import type { SentryRequestType } from '@sentry/types';

import * as session from '../account/session';
import { ChangeBufferEvent, database as db } from '../common/database';
import { SENTRY_OPTIONS } from '../common/sentry';
import * as models from '../models/index';
import { isSettings } from '../models/settings';

let enabled = false;

/**
 * Watch setting for changes. This must be called after the DB is initialized.
 */
export function sentryWatchAnalyticsEnabled() {
  models.settings.get().then(settings => {
    enabled = settings.enableAnalytics || session.isLoggedIn();
  });

  db.onChange(async (changes: ChangeBufferEvent[]) => {
    for (const change of changes) {
      const [event, doc] = change;
      if (isSettings(doc) && event === 'update') {
        enabled = doc.enableAnalytics || session.isLoggedIn();
      }
    }
  });
}

// TODO(johnwchadwick): We are vendoring ElectronOfflineNetTransport just to be able to control whether or not sending is allowed, because we don't have a choice right now. We should work with the upstream library to get similar functionality upstream. See getsentry/sentry-electron#489.
// https://github.com/getsentry/sentry-electron/issues/489
class ElectronSwitchableTransport extends Sentry.ElectronOfflineNetTransport {
  protected _isRateLimited(requestType: SentryRequestType) {
    if (!enabled) {
      return true;
    }

    return super._isRateLimited(requestType);
  }
}

export function initializeSentry() {
  Sentry.init({
    ...SENTRY_OPTIONS,
    transport: ElectronSwitchableTransport,
  });
}
