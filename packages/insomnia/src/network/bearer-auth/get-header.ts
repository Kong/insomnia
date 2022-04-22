import type { RequestHeader } from '../../models/request';

export function getBearerAuthHeader(token: string, prefix: string) {
  const name = 'Authorization';
  const value = `${prefix || 'Bearer'} ${token}`;
  const requestHeader: RequestHeader = {
    name,
    value,
  };
  return requestHeader;
}
