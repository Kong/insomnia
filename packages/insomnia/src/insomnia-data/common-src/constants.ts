export const CONTENT_TYPE_FORM_URLENCODED = 'application/x-www-form-urlencoded';
export const CONTENT_TYPE_GRAPHQL = 'application/graphql';
export const CONTENT_TYPE_JSON = 'application/json';
export const METHOD_GET = 'GET';

export function getContentTypeFromHeaders(headers: any[], defaultValue: string | null = null) {
  if (!Array.isArray(headers)) {
    return null;
  }

  const header = headers.find(({ name }) => name.toLowerCase() === 'content-type');
  return header ? header.value : defaultValue;
}

export type OAuth1SignatureMethod = 'HMAC-SHA1' | 'RSA-SHA1' | 'HMAC-SHA256' | 'PLAINTEXT';
export const SIGNATURE_METHOD_HMAC_SHA1: OAuth1SignatureMethod = 'HMAC-SHA1';
export const SIGNATURE_METHOD_HMAC_SHA256: OAuth1SignatureMethod = 'HMAC-SHA256';
export const SIGNATURE_METHOD_RSA_SHA1: OAuth1SignatureMethod = 'RSA-SHA1';
export const SIGNATURE_METHOD_PLAINTEXT: OAuth1SignatureMethod = 'PLAINTEXT';

export const getAppDefaultTheme = () => 'default';
export const getAppDefaultLightTheme = () => 'studio-light';
export const getAppDefaultDarkTheme = () => 'default';
