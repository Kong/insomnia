// @flow

import type { RequestHeader } from '../../models/request';

export function getBasicAuthHeader(
  username: ?string,
  password: ?string
): RequestHeader {
  const name = 'Authorization';
  const header = `${username || ''}:${password || ''}`;
  const authString = Buffer.from(header, 'utf8').toString('base64');
  const value = `Basic ${authString}`;
  return { name, value };
}
