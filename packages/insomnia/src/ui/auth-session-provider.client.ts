import { invariant } from '~/common/utils/invariant';
import * as session from '~/ui/account/session';

import { getAppWebsiteBaseURL, getInsomniaPublicKey, getInsomniaSecretKey } from '../common/constants';

interface AuthBox {
  token: string;
  key: string;
}

/** Normalize binary data returned from main-process IPC (may be Uint8Array, Buffer-like, or number[]). */
export function toUint8Array(data: Uint8Array | number[] | ArrayBuffer | { data?: number[] }): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  if (data && typeof data === 'object' && Array.isArray(data.data)) {
    return new Uint8Array(data.data);
  }
  throw new Error('Unexpected binary data format from authentication handshake.');
}

async function initSessionKeyPair(): Promise<void> {
  const envPublicKey = getInsomniaPublicKey();
  const envSecretKey = getInsomniaSecretKey();
  if (envPublicKey && envSecretKey) {
    window.localStorage.setItem('insomnia.publicKey', envPublicKey);
    window.localStorage.setItem('insomnia.secretKey', envSecretKey);
    return;
  }

  try {
    const kp = await window.main.sealedBox.keyPair();
    const pub = await encodeBase64(toUint8Array(kp.publicKey));
    window.localStorage.setItem('insomnia.publicKey', pub);
    const sec = await encodeBase64(toUint8Array(kp.secretKey));
    window.localStorage.setItem('insomnia.secretKey', sec);
  } catch (error) {
    console.error('Failed to initialize login keypair.', error);
    throw error;
  }
}

const sessionKeyPairPromise = typeof window !== 'undefined' ? initSessionKeyPair() : Promise.resolve();

/** Wait until the login handshake keypair is stored in localStorage before opening the browser or submitting a token. */
export async function ensureSessionKeyPair(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  await sessionKeyPairPromise;
  if (!window.localStorage.getItem('insomnia.publicKey') || !window.localStorage.getItem('insomnia.secretKey')) {
    throw new Error('Login keys are not ready yet. Please wait a moment and try again.');
  }
}
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
    await ensureSessionKeyPair();

    const trimmedCode = code.trim();
    invariant(trimmedCode, 'Authentication code is required.');

    const rawBox = await decodeBase64(trimmedCode);
    const publicKey = await decodeBase64(window.localStorage.getItem('insomnia.publicKey') || '');
    const secretKey = await decodeBase64(window.localStorage.getItem('insomnia.secretKey') || '');
    const boxData = await window.main.sealedBox.open(rawBox, publicKey, secretKey);
    invariant(boxData, 'Invalid authentication code. The code may have expired or was generated for a different app session — try logging in again from the login page.');

    const decoder = new TextDecoder();
    const box: AuthBox = JSON.parse(decoder.decode(toUint8Array(boxData)));
    invariant(typeof box.token === 'string' && box.token, 'Invalid authentication code: missing session token.');
    invariant(typeof box.key === 'string' && box.key, 'Invalid authentication code: missing session key.');
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
  url.searchParams.set('loginKey', publicKey);
  url.searchParams.set('source_origin', 'desktop_app');

  return url.toString();
}
