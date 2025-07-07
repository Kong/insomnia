import { getCurrentSessionId, type SessionData, unsetSessionData } from '../common/account/session';
import { insomniaFetch } from '../common/insomniaFetch';
import { userSession } from '../models';

/** Log out and delete session data */
export async function logout() {
  const sessionId = await getCurrentSessionId();
  if (sessionId) {
    try {
      insomniaFetch({
        method: 'POST',
        path: '/auth/logout',
        sessionId,
      });
    } catch (error) {
      // Not a huge deal if this fails, but we don't want it to prevent the
      // user from signing out.
      console.warn('Failed to logout', error);
    }
  }

  unsetSessionData();
  window.main.loginStateChange();
}

export async function migrateFromLocalStorage() {
  const sessionId = window.localStorage.getItem('currentSessionId');

  if (!sessionId) {
    return;
  }

  const sessionKey = `session__${(sessionId || '').slice(0, 10)}`;
  const session = window.localStorage.getItem(sessionKey);

  if (!session) {
    return;
  }

  try {
    const sessionData = JSON.parse(session) as SessionData;

    const currentUserSession = await userSession.getOrCreate();

    if (currentUserSession.id) {
      console.warn('Session already exists, skipping migration');
    } else {
      await userSession.update(currentUserSession, sessionData);
    }
  } catch (e) {
    console.error('Failed to parse session data', e);
  } finally {
    // Clean up local storage session data
    window.localStorage.removeItem(sessionKey);
    window.localStorage.removeItem('currentSessionId');
  }

  return;
}
