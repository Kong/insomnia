import { models, services } from 'insomnia-data';

import { getConfidentialValuePolicy } from '~/common/templating/confidential-value-policy';
import type { RenderPurpose, SensitiveValueCollector } from '~/common/templating/types';
import { decryptVaultKeyFromSession } from '~/common/utils/vault';
import { getRuntime } from '~/runtimes';

/**
 * Returns the vault secrets decrypted or masked, never mutating the input.
 * Callers may hand in data that belongs to a persisted environment document, mutating it in place
 * would overwrite the stored ciphertext with plaintext.
 *
 * Given an object the result is always a fresh copy; a non-object input is returned as is.
 */
export async function maskOrDecryptVaultDataIfNecessary({
  vaultEnvironmentData,
  renderPurpose,
  hideSecretValues,
  forceReveal,
  sensitiveValueCollector,
}: {
  vaultEnvironmentData: any;
  renderPurpose?: RenderPurpose;
  hideSecretValues?: boolean;
  forceReveal?: boolean;
  sensitiveValueCollector?: SensitiveValueCollector | null;
}) {
  // getConfidentialValuePolicy is the single decision point for reveal/mask across all render surfaces
  const shouldDecrypt =
    getConfidentialValuePolicy({ purpose: renderPurpose, hideSecretValues, forceReveal }) === 'reveal';
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
        if (sensitiveValueCollector && typeof decrypted[vaultContextKey] === 'string') {
          sensitiveValueCollector.register(decrypted[vaultContextKey]);
        }
      }
      return decryptedData;
    }
    if (isVaultEnabled && !vaultKey) {
      // remove all values under vaultEnvironmentPath if no vault key found
      return {};
    }
    // nothing to decrypt, still hand back a copy so no caller can reach the stored data through it
    return { ...vaultEnvironmentData };
  }
  // mask all secret values under vaultEnvironmentPath property in context
  const maskedData: Record<string, any> = {};
  Object.keys(vaultEnvironmentData).forEach(vaultContextKey => {
    maskedData[vaultContextKey] = models.environment.vaultEnvironmentMaskValue;
  });
  return maskedData;
}
