// @flow

type SignatureMethod = 'HMAC-SHA1' | 'RSA-SHA1' | 'PLAINTEXT';
type Token = { key: string, secret?: string };
type RequestData = {
  url: string,
  method: string,
  data?: { [string]: string }
};

type OAuth1Config = {
  consumer: {
    key: string,
    secret: string
  },
  signature_method: 'HMAC-SHA1' | 'RSA-SHA1' | 'PLAINTEXT',
  version: '1.0',
  hash_function: (signatureMethod: SignatureMethod, key: string) => string
};

declare class OAuth1 {
  constructor(config: OAuth1Config): OAuth1;
  authorize: (data: RequestData, token: Token | null) => RequestData;
  toHeader: (data: RequestData) => { Authorization: string };
  getSigningKey: (tokenSecret: string) => string;
}

declare module 'oauth-1.0a' {
  declare module.exports: typeof OAuth1;
}
