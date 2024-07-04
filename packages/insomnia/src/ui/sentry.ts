import * as Sentry from '@sentry/electron/renderer';

import { getAccountId, onLoginLogout } from '../account/session';
import { SENTRY_OPTIONS } from '../common/sentry';

/** Configures user info in Sentry scope. */
function sentryConfigureUserInfo() {
  Sentry.configureScope(async scope => {
    const id = await getAccountId();
    if (id) {
      scope.setUser({ id });
    } else {
      scope.setUser(null);
    }
  });
}

/** Watches user info for changes. */
function sentryWatchUserInfo() {
  sentryConfigureUserInfo();
  onLoginLogout(() => sentryConfigureUserInfo());
}

export function initializeSentry() {
  Sentry.init(SENTRY_OPTIONS);
  sentryWatchUserInfo();
}
