/**
 * Get an OAuth1Token object and also handle storing/saving/refreshing
 * @returns {Promise.<void>}
 */
import OAuth1 from 'oauth-1.0a';

import type { RequestAuthentication, RequestBody } from '~/insomnia-data';

import { CONTENT_TYPE_FORM_URLENCODED } from '../../common/constants';
import type { OAuth1SignatureMethod } from './constants';
import {
  SIGNATURE_METHOD_HMAC_SHA1,
  SIGNATURE_METHOD_HMAC_SHA256,
  SIGNATURE_METHOD_PLAINTEXT,
  SIGNATURE_METHOD_RSA_SHA1,
} from './constants';

async function computeHmac(algorithm: 'SHA-1' | 'SHA-256', key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign'],
  );
  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}

async function computeRsaSha1Sign(privateKeyPem: string, data: string): Promise<string> {
  // Dynamic import keeps node:crypto out of the renderer bundle
  const modulePath = 'node:crypto';
  const { createSign } = await import(/* @vite-ignore */ modulePath);
  return createSign('RSA-SHA1').update(data).sign(privateKeyPem, 'base64');
}

function generateNonce(): string {
  return Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default async function getToken(
  url: string,
  method: string,
  authentication: Extract<RequestAuthentication, { type: 'oauth1' }>,
  body: RequestBody | null = null,
) {
  const signatureMethod: OAuth1SignatureMethod = authentication.signatureMethod || 'HMAC-SHA1';

  const oauth = new OAuth1({
    consumer: {
      key: authentication.consumerKey || '',
      secret: authentication.consumerSecret || '',
    },
    signature_method: signatureMethod,
    version: authentication.version,
    // Placeholder — actual signing is done asynchronously below
    hash_function: (base, key) => base + key,
    realm: authentication.realm,
  });

  const requestData: OAuth1.RequestOptions = {
    url,
    method,
    includeBodyHash: false,
    data: {},
  };

  if (authentication.callback) {
    requestData.data.oauth_callback = authentication.callback;
  }
  if (authentication.verifier) {
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
    token = { key: authentication.tokenKey, secret: authentication.tokenSecret };
  } else if (authentication.tokenKey) {
    // @ts-expect-error -- TSCONVERSION likely needs a `secret: undefined` or the type is not actually correct.
    token = { key: authentication.tokenKey };
  }

  if (signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
    token = { key: authentication.tokenKey || '', secret: authentication.privateKey || '' };
    oauth.getSigningKey = (tokenSecret: string | undefined) => tokenSecret || '';
  }

  // Build oauth_data manually, mirroring oauth-1.0a's authorize() logic
  const oauthData: Record<string, string> = {
    oauth_consumer_key: authentication.consumerKey || '',
    oauth_nonce: authentication.nonce || generateNonce(),
    oauth_signature_method: signatureMethod,
    oauth_timestamp: authentication.timestamp || String(Math.floor(Date.now() / 1000)),
    oauth_version: authentication.version || '1.0',
  };
  if (token?.key) {
    oauthData.oauth_token = token.key;
  }

  // Retrieve base string and signing key from the library
  const baseString: string = (oauth as any).getBaseString(requestData, oauthData);
  const signingKey: string = (oauth as any).getSigningKey(token?.secret);

  let signature: string;
  if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA1) {
    signature = await computeHmac('SHA-1', signingKey, baseString);
  } else if (signatureMethod === SIGNATURE_METHOD_HMAC_SHA256) {
    signature = await computeHmac('SHA-256', signingKey, baseString);
  } else if (signatureMethod === SIGNATURE_METHOD_RSA_SHA1) {
    signature = await computeRsaSha1Sign(token?.secret || '', baseString);
  } else if (signatureMethod === SIGNATURE_METHOD_PLAINTEXT) {
    signature = signingKey;
  } else {
    throw new Error(`Invalid signature method ${signatureMethod}`);
  }

  oauthData.oauth_signature = signature;
  return (oauth as any).toHeader(oauthData) as { Authorization: string };
}
