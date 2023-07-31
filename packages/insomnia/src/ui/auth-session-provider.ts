import { decodeBase64, encodeBase64 } from '@getinsomnia/api-client/base64';
import { keyPair, open } from '@getinsomnia/api-client/sealedbox';
import * as Sentry from '@sentry/electron';

import * as session from '../account/session';
import { getAppWebsiteBaseURL } from '../common/constants';
import { invariant } from '../utils/invariant';

interface AuthBox {
  token: string;
  key: string;
}
const sessionKeyPair = keyPair();
encodeBase64(sessionKeyPair.publicKey).then(res => {
  window.localStorage.setItem('insomnia.publicKey', res);
});
encodeBase64(sessionKeyPair.secretKey).then(res => {
  window.localStorage.setItem('insomnia.secretKey', res);
});
/**
 * Keypair used for the login handshake.
 * This keypair can be re-used for the entire session.
 */
export async function submitAuthCode(code: string) {
  try {
    const rawBox = await decodeBase64(code.trim());
    const publicKey = await decodeBase64(window.localStorage.getItem('insomnia.publicKey') || '');
    const secretKey = await decodeBase64(window.localStorage.getItem('insomnia.secretKey') || '');
    const boxData = open(rawBox, publicKey, secretKey);
    invariant(boxData, 'Invalid authentication code.');

    const decoder = new TextDecoder();
    const box: AuthBox = JSON.parse(decoder.decode(boxData));
    await session.absorbKey(box.token, box.key);
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export function getLoginUrl() {
  const publicKey = window.localStorage.getItem('insomnia.publicKey');
  if (!publicKey) {
    console.log('No public key found');
    return '';
  }

  const url = new URL(getAppWebsiteBaseURL());

  url.pathname = '/app/auth-app/';
  url.searchParams.set('loginKey', encodeURIComponent(publicKey));

  return url.toString();
}
