import crypto from 'node:crypto';

import OAuth1 from 'oauth-1.0a';

import type { OAuth1SignatureMethod } from '~/network/o-auth-1/constants';
import {
  SIGNATURE_METHOD_HMAC_SHA1,
  SIGNATURE_METHOD_HMAC_SHA256,
  SIGNATURE_METHOD_PLAINTEXT,
  SIGNATURE_METHOD_RSA_SHA1,
} from '~/network/o-auth-1/constants';

import { ipcMainHandle } from './electron';

function hashFunction(signatureMethod: OAuth1SignatureMethod) {
  if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA1) {
    return function (baseString: string, key: string) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA256) {
    return function (baseString: string, key: string) {
      return crypto.createHmac('sha256', key).update(baseString).digest('base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
    return function (baseString: string, privatekey: string) {
      return crypto.createSign('RSA-SHA1').update(baseString).sign(privatekey, 'base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_PLAINTEXT) {
    return function (baseString: string) {
      return baseString;
    };
  }

  throw new Error(`Invalid signature method ${signatureMethod}`);
}

export interface OAuth1AuthParams {
  url: string;
  method: string;
  signatureMethod: OAuth1SignatureMethod;
  consumerKey: string;
  consumerSecret: string;
  version?: string;
  realm?: string;
  tokenKey?: string;
  tokenSecret?: string;
  privateKey?: string;
  nonce?: string;
  timestamp?: string;
  verifier?: string;
  callback?: string;
  includeBodyHash?: boolean;
  formParams?: { name: string; value: string }[];
}

export interface OAuthCryptoBridgeAPI {
  getOAuth1AuthHeader: (params: OAuth1AuthParams) => Promise<{ Authorization: string }>;
}

/** Pure signing function used by both the IPC handler and unit tests. */
export function oauth1SignRequest(params: OAuth1AuthParams): { Authorization: string } {
  const oauth = new OAuth1({
    consumer: {
      key: params.consumerKey,
      secret: params.consumerSecret,
    },
    signature_method: params.signatureMethod,
    version: params.version,
    hash_function: hashFunction(params.signatureMethod || 'HMAC-SHA1'),
    realm: params.realm,
  });

  const requestData: OAuth1.RequestOptions = {
    url: params.url,
    method: params.method,
    includeBodyHash: false,
    data: {},
  };

  if (params.callback) {
    requestData.data.oauth_callback = params.callback;
  }

  if (params.nonce) {
    requestData.data.oauth_nonce = params.nonce;
  }

  if (params.timestamp) {
    requestData.data.oauth_timestamp = params.timestamp;
  }

  if (params.verifier) {
    requestData.data.oauth_verifier = params.verifier;
  }

  if (params.includeBodyHash) {
    requestData.includeBodyHash = true;
    for (const p of params.formParams || []) {
      requestData.data[p.name] = p.value;
    }
  }

  let token: OAuth1.Token | undefined;

  if (params.tokenKey && params.tokenSecret) {
    token = { key: params.tokenKey, secret: params.tokenSecret };
  } else if (params.tokenKey) {
    // @ts-expect-error -- TSCONVERSION likely needs a `secret: undefined` or the type is not actually correct.
    token = { key: params.tokenKey };
  }

  if (params.signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
    token = {
      key: params.tokenKey || '',
      secret: params.privateKey || '',
    };
    oauth.getSigningKey = function (tokenSecret) {
      return tokenSecret || '';
    };
  }

  const data = oauth.authorize(requestData, token);
  return oauth.toHeader(data);
}

export function registerOAuthHandlers() {
  ipcMainHandle('oauthCrypto.getOAuth1AuthHeader', (_, params: OAuth1AuthParams) => {
    return oauth1SignRequest(params);
  });
}
