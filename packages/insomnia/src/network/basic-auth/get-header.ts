import type { RequestHeader } from 'insomnia-data';

import { bytesToBase64, latin1BytesFromString, utf8ToBase64 } from '~/utils/utf8-bytes';

export function getBasicAuthHeader(username?: string | null, password?: string | null, encoding = 'utf8') {
  const name = 'Authorization';
  const header = `${username || ''}:${password || ''}`;
  const authString = encoding === 'latin1' ? bytesToBase64(latin1BytesFromString(header)) : utf8ToBase64(header);
  const value = `Basic ${authString}`;
  const requestHeader: RequestHeader = {
    name,
    value,
  };
  return requestHeader;
}
