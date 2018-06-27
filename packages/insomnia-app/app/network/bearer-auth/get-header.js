// @flow
import type { RequestHeader } from '../../models/request';

export function getBearerAuthHeader(
  token: string,
  prefix: string
): RequestHeader {
  const name = 'Authorization';
  const value = `${prefix || 'Bearer'} ${token}`;
  return { name, value };
}
