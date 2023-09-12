import { decodeBase64, encodeBase64 } from '@getinsomnia/api-client/base64';
import { keyPair, open } from '@getinsomnia/api-client/sealedbox';
import * as Sentry from '@sentry/electron';

import * as session from '../account/session';
import { invariant } from '../utils/invariant';

interface AuthBox {
  token: string;
  key: string;
}
const { INSOMNIA_PUBLIC_KEY, INSOMNIA_SECRET_KEY } = process.env;

const sessionKeyPair = keyPair();
encodeBase64(sessionKeyPair.publicKey).then(res => {
  try {
    window.localStorage.setItem('insomnia.publicKey', INSOMNIA_PUBLIC_KEY || res);
  } catch (error) {
    console.error('Failed to store public key in localStorage.');
  }
});
encodeBase64(sessionKeyPair.secretKey).then(res => {
  try {
    window.localStorage.setItem('insomnia.secretKey', INSOMNIA_SECRET_KEY || res);
  } catch (error) {
    console.error('Failed to store secret key in localStorage.');
  }
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

export function getLoginUrl(websiteUrl: string) {
  const publicKey = window.localStorage.getItem('insomnia.publicKey');
  if (!publicKey) {
    console.log('No public key found');
    return '';
  }

  const url = new URL(websiteUrl);

  url.pathname = '/app/auth-app/';
  url.searchParams.set('loginKey', encodeURIComponent(publicKey));

  return url.toString();
}
