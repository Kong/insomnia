import { getOauthRelayUrl } from '~/common/constants';
import type { DefaultBrowserRedirectParam } from '~/common/misc';

function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCodePoint(byte);
  });
  const base64 = btoa(binary);
  const lines = base64.match(/.{1,64}/g)?.join('\n') ?? base64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

export const encryptOAuthUrl = async (authCodeUrlStr: string) => {
  const cryptoApi = globalThis.crypto;
  const keyPair = await cryptoApi.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 3072,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const spkiBuffer = await cryptoApi.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyPem = arrayBufferToPem(spkiBuffer, 'PUBLIC KEY');

  const relayUrl = `${getOauthRelayUrl()}?authCodeUrl=${encodeURIComponent(authCodeUrlStr)}&publicKey=${encodeURIComponent(publicKeyPem)}`;

  const decryptOAuthResult = async (result: DefaultBrowserRedirectParam): Promise<string> => {
    if ('redirectUrl' in result) {
      return result.redirectUrl;
    }

    const { encryptedRedirectUrl, encryptedKey, iv } = result;

    // Decrypt the AES key using RSA-OAEP private key
    const aesKeyBytes = await cryptoApi.subtle.decrypt(
      { name: 'RSA-OAEP' },
      keyPair.privateKey,
      Buffer.from(encryptedKey, 'base64'),
    );

    const importedAesKey = await cryptoApi.subtle.importKey('raw', aesKeyBytes, { name: 'AES-GCM' }, false, [
      'decrypt',
    ]);

    // encryptedRedirectUrl is base64(ciphertext || authTag); AES-GCM expects that layout
    // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
    const decrypted = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64'), tagLength: 128 },
      importedAesKey,
      Buffer.from(encryptedRedirectUrl, 'base64'),
    );

    return new TextDecoder().decode(decrypted);
  };

  return {
    relayUrl,
    decryptOAuthResult,
  };
};

