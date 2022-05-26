import * as Sentry from '@sentry/electron';
import type * as SentryElectronMain from '@sentry/electron/main';
import type { SentryRequestType, Transport, TransportClass } from '@sentry/types';

import { getAccountId, onLoginLogout } from '../account/session';
import { database as db } from '../common/database';
import * as models from '../models/index';
import { isSettings } from '../models/settings';
import { getAppEnvironment, getAppVersion } from './constants';

let enabled = false;

// Configures user info in Sentry scope. This should only be called by the
// renderer thread, because it needs access to localStorage.
function sentryConfigureUserInfo() {
  Sentry.configureScope(scope => {
    const id = getAccountId();
    if (id) {
      scope.setUser({ id });
    } else {
      scope.setUser(null);
    }
  });
}

// Watches user info for changes. This should only be called by the renderer
// thread.
export function sentryWatchUserInfo() {
  sentryConfigureUserInfo();
  onLoginLogout(() => sentryConfigureUserInfo());
}

// Watch analytics setting for changes. This can be called in any thread after
// the database has been initialized.
export function sentryWatchAnalyticsEnabled() {
  models.settings.getOrCreate().then(settings => {
    enabled = settings.enableAnalytics;
  });

  db.onChange(async changes => {
    for (const change of changes) {
      const [event, doc] = change;
      if (isSettings(doc) && event === 'update') {
        enabled = doc.enableAnalytics;
      }
    }
  });
}

// TODO(johnwchadwick): We are vendoring ElectronOfflineNetTransport just to be
// able to control whether or not sending is allowed, because we don't have a
// choice right now. We should work with the upstream library to get similar
// functionality upstream. See getsentry/sentry-electron#489.
//
// https://github.com/getsentry/sentry-electron/issues/489
let transport: TransportClass<Transport> | undefined = undefined;

// The transport is only needed inside the browser (main) thread.
if (process.type === 'browser') {
  // We need to use Electron require here, no exceptions.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ElectronOfflineNetTransport } = require('@sentry/electron/main') as typeof SentryElectronMain;

  transport = class ElectronSwitchableTransport extends ElectronOfflineNetTransport {
    protected _isRateLimited(requestType: SentryRequestType) {
      if (!enabled) {
        return true;
      }

      return super._isRateLimited(requestType);
    }
  };
}

// Initialize Sentry. Sentry needs to be initialized as soon as possible; it
// will fail if the Electron ready event fires before it is initialized.
Sentry.init({
  dsn: 'https://aaec2e800e644070a8daba5b7ad02c16@o1147619.ingest.sentry.io/6311804',
  environment: getAppEnvironment(),
  release: getAppVersion(),
  transport,
});
