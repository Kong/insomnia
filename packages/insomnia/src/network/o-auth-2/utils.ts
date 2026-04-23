import crypto from 'node:crypto';

import { getOauthRelayUrl } from '~/common/constants';
import type { DefaultBrowserRedirectParam } from '~/common/misc';

export const encryptOAuthUrl = (authCodeUrlStr: string) => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const relayUrl = `${getOauthRelayUrl()}?authCodeUrl=${encodeURIComponent(authCodeUrlStr)}&publicKey=${encodeURIComponent(publicKey)}`;

  const decryptOAuthResult = (result: DefaultBrowserRedirectParam): string => {
    if ('redirectUrl' in result) {
      return result.redirectUrl;
    }

    const { encryptedRedirectUrl, encryptedKey, iv } = result;
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encryptedKey, 'base64'),
    );
    const encryptedBuf = Buffer.from(encryptedRedirectUrl, 'base64');
    const authTag = encryptedBuf.slice(-16);
    const ciphertext = encryptedBuf.slice(0, -16);
    // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, Buffer.from(iv, 'base64'), {
      authTagLength: 16,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return decrypted;
  };

  return {
    relayUrl,
    decryptOAuthResult,
  };
};
