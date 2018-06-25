// @flow
/**
 * Get an OAuth1Token object and also handle storing/saving/refreshing
 * @returns {Promise.<void>}
 */
import crypto from 'crypto';
import OAuth1 from 'oauth-1.0a';
import {
  SIGNATURE_METHOD_HMAC_SHA1,
  SIGNATURE_METHOD_RSA_SHA1,
  SIGNATURE_METHOD_PLAINTEXT,
  SIGNATURE_METHOD_HMAC_SHA256
} from './constants';
import type { OAuth1SignatureMethod } from './constants';
import type { RequestAuthentication } from '../../models/request';

function hashFunction(signatureMethod: OAuth1SignatureMethod) {
  if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA1) {
    return function(baseString: string, key: string): string {
      return crypto
        .createHmac('sha1', key)
        .update(baseString)
        .digest('base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA256) {
    return function(baseString: string, key: string): string {
      return crypto
        .createHmac('sha256', key)
        .update(baseString)
        .digest('base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
    return function(baseString: string, privatekey: string): string {
      return crypto
        .createSign('RSA-SHA1')
        .update(baseString)
        .sign(privatekey, 'base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_PLAINTEXT) {
    return function(baseString: string): string {
      return baseString;
    };
  }

  throw new Error(`Invalid signature method ${signatureMethod}`);
}

export default async function(
  url: string,
  method: string,
  authentication: RequestAuthentication
): { [string]: string } {
  const oauth = new OAuth1({
    consumer: {
      key: authentication.consumerKey,
      secret: authentication.consumerSecret
    },
    signature_method: authentication.signatureMethod,
    version: authentication.version,
    hash_function: hashFunction(authentication.signatureMethod),
    realm: authentication.realm || null
  });

  const requestData = {
    url: url,
    method: method,
    data: {
      // These are conditionally filled in below
    }
  };

  if (authentication.callback) {
    requestData.data.oauth_callback = authentication.callback;
  }

  if (authentication.nonce) {
    requestData.data.oauth_nonce = authentication.nonce;
  }

  if (authentication.timestamp) {
    requestData.data.oauth_timestamp = authentication.timestamp;
  }

  if (authentication.verifier) {
    requestData.data.oauth_verifier = authentication.verifier;
  }

  let token = null;
  if (authentication.tokenKey && authentication.tokenSecret) {
    token = {
      key: authentication.tokenKey,
      secret: authentication.tokenSecret
    };
  } else if (authentication.tokenKey) {
    token = { key: authentication.tokenKey };
  }

  if (authentication.signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
    token = { key: authentication.tokenKey, secret: authentication.privateKey };
    // We override getSigningKey for RSA-SHA1 because we don't want ddo/oauth-1.0a to percentEncode the token
    oauth.getSigningKey = function(tokenSecret) {
      return tokenSecret || '';
    };
  }

  const data = oauth.authorize(requestData, token);
  return oauth.toHeader(data);
}
