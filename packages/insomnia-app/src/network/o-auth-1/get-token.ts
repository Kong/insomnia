/**
 * Get an OAuth1Token object and also handle storing/saving/refreshing
 * @returns {Promise.<void>}
 */
import crypto from 'crypto';
import OAuth1 from 'oauth-1.0a';

import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import type { RequestAuthentication, RequestBody } from '../../models/request';
import type { OAuth1SignatureMethod } from './constants';
import {
  SIGNATURE_METHOD_HMAC_SHA1,
  SIGNATURE_METHOD_HMAC_SHA256,
  SIGNATURE_METHOD_PLAINTEXT,
  SIGNATURE_METHOD_RSA_SHA1,
} from './constants';

function hashFunction(signatureMethod: OAuth1SignatureMethod) {
  if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA1) {
    return function(baseString: string, key: string) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA256) {
    return function(baseString: string, key: string) {
      return crypto.createHmac('sha256', key).update(baseString).digest('base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
    return function(baseString: string, privatekey: string) {
      return crypto.createSign('RSA-SHA1').update(baseString).sign(privatekey, 'base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_PLAINTEXT) {
    return function(baseString: string) {
      return baseString;
    };
  }

  throw new Error(`Invalid signature method ${signatureMethod}`);
}

export default async function(
  url: string,
  method: string,
  authentication: RequestAuthentication,
  body: RequestBody | null = null,
) {
  const oauth = new OAuth1({
    consumer: {
      key: authentication.consumerKey,
      secret: authentication.consumerSecret,
    },
    signature_method: authentication.signatureMethod,
    version: authentication.version,
    hash_function: hashFunction(authentication.signatureMethod),
    realm: authentication.realm || null,
  });
  const requestData = {
    url: url,
    method: method,
    includeBodyHash: false,
    data: {
      // These are conditionally filled in below
    },
  };

  if (authentication.callback) {
    // @ts-expect-error -- TSCONVERSION needs type widening
    requestData.data.oauth_callback = authentication.callback;
  }

  if (authentication.nonce) {
    // @ts-expect-error -- TSCONVERSION needs type widening
    requestData.data.oauth_nonce = authentication.nonce;
  }

  if (authentication.timestamp) {
    // @ts-expect-error -- TSCONVERSION needs type widening
    requestData.data.oauth_timestamp = authentication.timestamp;
  }

  if (authentication.verifier) {
    // @ts-expect-error -- TSCONVERSION needs type widening
    requestData.data.oauth_verifier = authentication.verifier;
  }

  if (authentication.includeBodyHash && body && body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    requestData.includeBodyHash = true;

    for (const p of body.params || []) {
      requestData.data[p.name] = p.value;
    }
  }

  let token: OAuth1.Token | undefined;

  if (authentication.tokenKey && authentication.tokenSecret) {
    token = {
      key: authentication.tokenKey,
      secret: authentication.tokenSecret,
    };
  } else if (authentication.tokenKey) {
    // @ts-expect-error -- TSCONVERSION likely needs a `secret: undefined` or the type is not actually correct.
    token = {
      key: authentication.tokenKey,
    };
  }

  if (authentication.signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
    token = {
      key: authentication.tokenKey,
      secret: authentication.privateKey,
    };

    // We override getSigningKey for RSA-SHA1 because we don't want ddo/oauth-1.0a to percentEncode the token
    oauth.getSigningKey = function(tokenSecret) {
      return tokenSecret || '';
    };
  }

  const data = oauth.authorize(requestData, token);
  return oauth.toHeader(data);
}
