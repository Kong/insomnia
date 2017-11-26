// @flow
import type {RequestHeader} from '../../models/request';

export function getBearerAuthHeader (token: string): RequestHeader {
  const name = 'Authorization';
  const value = `Bearer ${token}`;
  return {name, value};
}
