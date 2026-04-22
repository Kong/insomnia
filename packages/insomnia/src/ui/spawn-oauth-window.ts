import { v4 as uuidv4 } from 'uuid';

import { OAUTH_WINDOW_SESSION_ID_KEY } from '~/common/constants';

export async function initNewOAuthSession() {
  // the value of this variable needs to start with 'persist:'
  // otherwise sessions won't be persisted over application-restarts
  const authWindowSessionId = `persist:oauth2_${uuidv4()}`;
  await window.main.electronStorage.setItem(OAUTH_WINDOW_SESSION_ID_KEY, authWindowSessionId);
  return authWindowSessionId;
}

export const clearOAuthWindowSessionId = async () => {
  await window.main.electronStorage.setItem(OAUTH_WINDOW_SESSION_ID_KEY, '');
};
