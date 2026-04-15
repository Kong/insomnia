import { getOauthRelayUrl } from '~/common/constants';
import type { DefaultBrowserRedirectParam } from '~/common/misc';

function derToPem(der: ArrayBuffer): string {
  const bytes = new Uint8Array(der);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  const b64 = btoa(binary);
  const wrapped = b64.match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

export const encryptOAuthUrl = async (authCodeUrlStr: string) => {
  const { publicKey, privateKey } = await globalThis.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const spki = await globalThis.crypto.subtle.exportKey('spki', publicKey);
  const publicKeyPem = derToPem(spki);

  const relayUrl = `${getOauthRelayUrl()}?authCodeUrl=${encodeURIComponent(authCodeUrlStr)}&publicKey=${encodeURIComponent(publicKeyPem)}`;

  const decryptOAuthResult = async (result: DefaultBrowserRedirectParam): Promise<string> => {
    if ('redirectUrl' in result) {
      return result.redirectUrl;
    }

    const { encryptedRedirectUrl, encryptedKey, iv } = result;

    const aesKeyBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      Buffer.from(encryptedKey, 'base64'),
    );

    const cryptoAesKey = await globalThis.crypto.subtle.importKey('raw', aesKeyBuf, { name: 'AES-GCM' }, false, [
      'decrypt',
    ]);

    // encryptedRedirectUrl is ciphertext || authTag(16 bytes) — SubtleCrypto AES-GCM expects this layout
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64'), tagLength: 128 },
      cryptoAesKey,
      Buffer.from(encryptedRedirectUrl, 'base64'),
    );

    return new TextDecoder().decode(decrypted);
  };

  return { relayUrl, decryptOAuthResult };
};
