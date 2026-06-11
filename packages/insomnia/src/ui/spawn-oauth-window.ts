import { OAUTH_WINDOW_SESSION_ID_KEY } from '~/common/constants';

export const clearOAuthWindowSessionId = async () => {
  await window.main.electronStorage.setItem(OAUTH_WINDOW_SESSION_ID_KEY, '');
};
