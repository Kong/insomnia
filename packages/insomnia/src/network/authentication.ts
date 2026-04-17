import type { RequestAuthentication, RequestParameter } from '~/insomnia-data';

import type { RenderedRequest } from '../templating/types';
import { QUERY_PARAMS } from './api-key/constants';

export async function getAuthHeader(renderedRequest: RenderedRequest, url: string) {
  return (await import('../main/network/get-auth-header')).getAuthHeader(renderedRequest, url);
}

export function getAuthQueryParams(authentication: RequestAuthentication) {
  if (authentication.disabled) {
    return;
  }

  if (authentication.type === 'apikey' && authentication.addTo === QUERY_PARAMS) {
    const { key, value } = authentication;
    return {
      name: key,
      value: value,
    } as RequestParameter;
  }

  return;
}

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
export const getAuthObjectOrNull = (auth?: RequestAuthentication | {} | null): RequestAuthentication | null =>
  !auth || Object.keys(auth).length === 0 || !('type' in auth) ? null : auth;
