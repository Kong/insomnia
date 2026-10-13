import { models, services } from 'insomnia-data';

import type { RenderPurpose } from '~/common/templating/types';
import { decryptVaultKeyFromSession } from '~/common/utils/vault';
import { getRuntime } from '~/runtimes';

/**
 * Returns a new object with the vault secrets decrypted or masked, the input is never mutated.
 * Callers may hand in data that belongs to a persisted environment document, mutating it in place
 * would overwrite the stored ciphertext with plaintext.
 */
export async function maskOrDecryptVaultDataIfNecessary(vaultEnvironmentData: any, renderPurpose?: RenderPurpose) {
  /**
   * Decrypt secrets when renderPurpose is one of the following:
   * - preview: render the template in variable editor to do the live preview
   * - send: render the template when sending requests
   * - script: render the template in pre-request or after-response script
   */
  const shouldDecrypt = renderPurpose === 'preview' || renderPurpose === 'send' || renderPurpose === 'script';
  if (typeof vaultEnvironmentData !== 'object' || vaultEnvironmentData === null) {
    return vaultEnvironmentData;
  }
  if (shouldDecrypt) {
    const { vaultKey, vaultSalt } = await services.userSession.get();
    const isVaultEnabled = !!vaultSalt;
    if (isVaultEnabled && vaultKey) {
      const symmetricKey = (await decryptVaultKeyFromSession(vaultKey, true)) as JsonWebKey;
      // decrypt all secret values under vaultEnvironmentPath property in context
      const decryptedData: Record<string, any> = {};
      for (const vaultContextKey of Object.keys(vaultEnvironmentData)) {
        const encryptedValue = vaultEnvironmentData[vaultContextKey];
        decryptedData[vaultContextKey] = await getRuntime().crypto.decryptSecretValue(encryptedValue, symmetricKey);
      }
      return decryptedData;
    }
    if (isVaultEnabled && !vaultKey) {
      // remove all values under vaultEnvironmentPath if no vault key found
      return {};
    }
    return vaultEnvironmentData;
  }
  // mask all secret values under vaultEnvironmentPath property in context
  const maskedData: Record<string, any> = {};
  Object.keys(vaultEnvironmentData).forEach(vaultContextKey => {
    maskedData[vaultContextKey] = models.environment.vaultEnvironmentMaskValue;
  });
  return maskedData;
}
