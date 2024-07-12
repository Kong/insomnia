import { keyPair, open } from '@getinsomnia/api-client/sealedbox';

import * as session from '../account/session';
import { getAppWebsiteBaseURL, getInsomniaPublicKey, getInsomniaSecretKey } from '../common/constants';
import { invariant } from '../utils/invariant';

interface AuthBox {
  token: string;
  key: string;
}

const sessionKeyPair = keyPair();
encodeBase64(sessionKeyPair.publicKey).then(res => {
  try {
    window.localStorage.setItem('insomnia.publicKey', getInsomniaPublicKey() || res);
  } catch (error) {
    console.error('Failed to store public key in localStorage.');
  }
});
encodeBase64(sessionKeyPair.secretKey).then(res => {
  try {
    window.localStorage.setItem('insomnia.secretKey', getInsomniaSecretKey() || res);
  } catch (error) {
    console.error('Failed to store secret key in localStorage.');
  }
});
/**
 * Keypair used for the login handshake.
 * This keypair can be re-used for the entire session.
 */

export async function decodeBase64(base64: string): Promise<Uint8Array> {
  try {
    let uri = 'data:application/octet-binary;base64,';
    uri += base64;
    const res = await fetch(uri);
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);

  } catch (error) {
    console.error(error);
    throw new Error('Failed to decode base64');
  }
}

export async function encodeBase64(data: Uint8Array): Promise<string> {
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject();
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(new Blob([data]));
  });

  const dataAt = dataUri.indexOf(',');
  if (dataAt === -1) {
    throw new Error(`unexpected data uri output: ${dataUri}`);
  }

  return dataUri.slice(dataAt + 1);
}

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
    console.error(error);
    return error;
  }
}

export function getLoginUrl() {
  const publicKey = window.localStorage.getItem('insomnia.publicKey');
  if (!publicKey) {
    console.log('[auth] No public key found');
    return '';
  }

  const url = new URL(getAppWebsiteBaseURL());

  url.pathname = '/app/auth-app/';
  url.searchParams.set('loginKey', encodeURIComponent(publicKey));

  return url.toString();
}
