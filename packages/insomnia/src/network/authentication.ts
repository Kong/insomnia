import type { RequestAuthentication } from '~/insomnia-data';

export const _buildBearerHeader = (accessToken: string, prefix?: string) => {
  if (!accessToken) {
    return;
  }

  const header = {
    name: 'Authorization',
    value: '',
  };

  header.value = prefix === 'NO_PREFIX' ? accessToken : `${prefix || 'Bearer'} ${accessToken}`;

  return header;
};
export const isAuthEnabled = (auth?: RequestAuthentication | {}) =>
  auth && 'disabled' in auth ? auth.disabled !== true : true;
// TODO: 这里应该检查type不为none
export const getAuthObjectOrNull = (auth?: RequestAuthentication | {} | null): RequestAuthentication | null =>
  !auth || Object.keys(auth).length === 0 || !('type' in auth) ? null : auth;
