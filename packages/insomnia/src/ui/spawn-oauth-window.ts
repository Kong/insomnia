import { v4 as uuidv4 } from 'uuid';

export const LOCALSTORAGE_KEY_SESSION_ID = 'insomnia::current-oauth-session-id';
export async function initNewOAuthSession() {
  // the value of this variable needs to start with 'persist:'
  // otherwise sessions won't be persisted over application-restarts
  const authWindowSessionId = `persist:oauth2_${uuidv4()}`;
  await window.main.electronStorage.setItem(LOCALSTORAGE_KEY_SESSION_ID, authWindowSessionId);
  return authWindowSessionId;
}

export const clearOAuthWindowSessionId = async () => {
  await window.main.electronStorage.setItem(LOCALSTORAGE_KEY_SESSION_ID, '');
};
