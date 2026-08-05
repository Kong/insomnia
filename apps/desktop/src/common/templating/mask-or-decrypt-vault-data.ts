import { models, services } from 'insomnia-data';

import type { RenderPurpose } from '~/common/templating/types';
import { decryptVaultKeyFromSession } from '~/common/utils/vault';
import { getRuntime } from '~/runtimes';

export async function maskOrDecryptVaultDataIfNecessary(vaultEnvironmentData: any, renderPurpose?: RenderPurpose) {
  /**
   * Decrypt secrets when renderPurpose is one of the following:
   * - preview: render the template in variable editor to do the live preview
   * - send: render the template when sending requests
   * - script: render the template in pre-request or after-response script
   */
  const shouldDecrypt = renderPurpose === 'preview' || renderPurpose === 'send' || renderPurpose === 'script';
  if (typeof vaultEnvironmentData === 'object') {
    if (shouldDecrypt) {
      const { vaultKey, vaultSalt } = await services.userSession.get();
      const isVaultEnabled = !!vaultSalt;
      if (isVaultEnabled && vaultKey) {
        const symmetricKey = (await decryptVaultKeyFromSession(vaultKey, true)) as JsonWebKey;
        // decrypt all secret values under vaultEnvironmentPath property in context
        for (const vaultContextKey of Object.keys(vaultEnvironmentData)) {
          const encryptedValue = vaultEnvironmentData[vaultContextKey];
          vaultEnvironmentData[vaultContextKey] = await getRuntime().crypto.decryptSecretValue(
            encryptedValue,
            symmetricKey,
          );
        }
      } else if (isVaultEnabled && !vaultKey) {
        // remove all values under vaultEnvironmentPath if no vault key found
        vaultEnvironmentData = {};
      }
    } else {
      // mask all secret values under vaultEnvironmentPath property in context
      Object.keys(vaultEnvironmentData).forEach(vaultContextKey => {
        vaultEnvironmentData[vaultContextKey] = models.environment.vaultEnvironmentMaskValue;
      });
    }
  }
  return vaultEnvironmentData;
}
