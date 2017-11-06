/**
 * Get an OAuth1Token object and also handle storing/saving/refreshing
 * @returns {Promise.<void>}
 */
import crypto from 'crypto';
import OAuth1 from 'oauth-1.0a';
import { SIGNATURE_METHOD_HMAC_SHA1, SIGNATURE_METHOD_PLAINTEXT } from './constants';

function hashFunction (signatureMethod) {
  if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA1) {
    return function (baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    };
  }

  if (signatureMethod === SIGNATURE_METHOD_PLAINTEXT) {
    return function (baseString) {
      return baseString;
    };
  }

  return null;
}

export default async function (url, method, authentication) {
  var oauth = OAuth1({
    consumer: {
      key: authentication.consumerKey,
      secret: authentication.consumerSecret
    },
    signature_method: authentication.signatureMethod,
    version: authentication.version,
    hash_function: hashFunction(authentication.signatureMethod)
  });

  var requestData = {
    url: url,
    method: method
  };

  return oauth.toHeader(oauth.authorize(requestData));
}
