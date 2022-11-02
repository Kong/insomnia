import { decodeBase64, encodeBase64 } from '@getinsomnia/api-client/base64';
import { keyPair, open } from '@getinsomnia/api-client/sealedbox';
import { invariant } from '@remix-run/router';
import * as Sentry from '@sentry/electron';

import * as session from '../account/session';
import { getAppWebsiteBaseURL } from '../common/constants';

interface AuthBox {
  token: string;
  key: string;
}

/**
 * Keypair used for the login handshake.
 * This keypair can be re-used for the entire session.
 */
const sessionKeyPair = keyPair();

export async function submitAuthCode(code: string) {
  try {
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
  const loginKey = await encodeBase64(sessionKeyPair.publicKey);
  return `${getAppWebsiteBaseURL()}/app/auth-app/?loginKey=${encodeURIComponent(loginKey)}`;
}
