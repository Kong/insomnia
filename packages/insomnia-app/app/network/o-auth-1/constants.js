// @flow
export type OAuth1SignatureMethod =
  | 'HMAC-SHA1'
  | 'RSA-SHA1'
  | 'HMAC-SHA256'
  | 'PLAINTEXT';
export const SIGNATURE_METHOD_HMAC_SHA1: OAuth1SignatureMethod = 'HMAC-SHA1';
export const SIGNATURE_METHOD_HMAC_SHA256: OAuth1SignatureMethod =
  'HMAC-SHA256';
export const SIGNATURE_METHOD_RSA_SHA1: OAuth1SignatureMethod = 'RSA-SHA1';
export const SIGNATURE_METHOD_PLAINTEXT: OAuth1SignatureMethod = 'PLAINTEXT';
