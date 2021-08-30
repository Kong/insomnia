import type { RequestHeader } from '../../models/request';

export function getBasicAuthHeader(
  username?: string | null,
  password?: string | null,
  encoding = 'utf8',
) {
  const name = 'Authorization';
  const header = `${username || ''}:${password || ''}`;
  // @ts-expect-error -- TSCONVERSION appears to be a genuine error
  const authString = Buffer.from(header, encoding).toString('base64');
  const value = `Basic ${authString}`;
  const requestHeader: RequestHeader = {
    name,
    value,
  };
  return requestHeader;
}
