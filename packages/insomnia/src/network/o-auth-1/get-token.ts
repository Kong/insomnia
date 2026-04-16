/**
 * Get an OAuth1Token object and also handle storing/saving/refreshing
 * @returns {Promise.<void>}
 */
import type { RequestAuthentication, RequestBody } from '~/insomnia-data';

import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import type { OAuth1SignatureMethod } from './constants';

export default async function getToken(
  url: string,
  method: string,
  authentication: Extract<RequestAuthentication, { type: 'oauth1' }>,
  body: RequestBody | null = null,
) {
  const formParams: { name: string; value: string }[] = [];
  let includeBodyHash = false;

  if (authentication.includeBodyHash && body && body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
    includeBodyHash = true;
    for (const p of body.params || []) {
      formParams.push({ name: p.name, value: p.value ?? '' });
    }
  }

  return window.main.oauthCrypto.getOAuth1AuthHeader({
    url,
    method,
    signatureMethod: (authentication.signatureMethod || 'HMAC-SHA1') as OAuth1SignatureMethod,
    consumerKey: authentication.consumerKey || '',
    consumerSecret: authentication.consumerSecret || '',
    version: authentication.version,
    realm: authentication.realm,
    tokenKey: authentication.tokenKey,
    tokenSecret: authentication.tokenSecret,
    privateKey: authentication.privateKey,
    nonce: authentication.nonce,
    timestamp: authentication.timestamp,
    verifier: authentication.verifier,
    callback: authentication.callback,
    includeBodyHash,
    formParams,
  });
}

