import type { RequestHeader } from '../../models/request';
export function getBasicAuthHeader(
  username: string | null | undefined,
  password: string | null | undefined,
  encoding: string | null | undefined = 'utf8',
): RequestHeader {
  const name = 'Authorization';
  const header = `${username || ''}:${password || ''}`;
  const authString = Buffer.from(header, encoding).toString('base64');
  const value = `Basic ${authString}`;
  return {
    name,
    value,
  };
}
