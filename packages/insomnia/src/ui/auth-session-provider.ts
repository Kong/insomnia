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

/**
 * Keypair used for the login handshake.
 * This keypair can be re-used for the entire session.
 */
export async function submitAuthCode(code: string) {
  try {
    const sessionKeyPair = keyPair();
    window.localStorage.setItem('insomnia.sessionKeyPair', JSON.stringify(sessionKeyPair));
    const rawBox = await decodeBase64(code.trim());
    const boxData = open(rawBox, sessionKeyPair.publicKey, sessionKeyPair.secretKey);
    invariant(boxData, 'Invalid authentication code.');

    const decoder = new TextDecoder();
    const box: AuthBox = JSON.parse(decoder.decode(boxData));
    await session.absorbKey(box.token, box.key);
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}

export async function getLoginUrl() {
  const sessionKeyPair = JSON.parse(window.localStorage.getItem('insomnia.sessionKeyPair') || '{}');
  invariant(sessionKeyPair.publicKey, 'No session keypair found');
  const loginKey = await encodeBase64(sessionKeyPair.publicKey);
  return `${getAppWebsiteBaseURL()}/app/auth-app/?loginKey=${encodeURIComponent(loginKey)}`;
}
