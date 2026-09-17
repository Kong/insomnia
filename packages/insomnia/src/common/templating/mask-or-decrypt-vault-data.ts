import { models, services } from 'insomnia-data';

import { getConfidentialValuePolicy } from '~/common/templating/confidential-value-policy';
import type { RenderPurpose, SensitiveValueCollector } from '~/common/templating/types';
import { decryptVaultKeyFromSession } from '~/common/utils/vault';
import { getRuntime } from '~/runtimes';

export async function maskOrDecryptVaultDataIfNecessary(
  vaultEnvironmentData: any,
  renderPurpose?: RenderPurpose,
  hideSecretValues?: boolean,
  forceReveal?: boolean,
  sensitiveValueCollector?: SensitiveValueCollector | null,
) {
  const shouldDecrypt =
    getConfidentialValuePolicy({ purpose: renderPurpose, hideSecretValues, forceReveal }) === 'reveal';

  if (typeof vaultEnvironmentData === 'object' && vaultEnvironmentData !== null) {
    if (shouldDecrypt) {
      const { vaultKey, vaultSalt } = await services.userSession.get();
      const isVaultEnabled = !!vaultSalt;
      if (isVaultEnabled && vaultKey) {
        const symmetricKey = (await decryptVaultKeyFromSession(vaultKey, true)) as JsonWebKey;
        const decrypted: Record<string, any> = {};
        for (const vaultContextKey of Object.keys(vaultEnvironmentData)) {
          decrypted[vaultContextKey] = await getRuntime().crypto.decryptSecretValue(
            vaultEnvironmentData[vaultContextKey],
            symmetricKey,
          );
          if (sensitiveValueCollector && typeof decrypted[vaultContextKey] === 'string') {
            sensitiveValueCollector.register(decrypted[vaultContextKey]);
          }
        }
        return decrypted;
      } else if (isVaultEnabled && !vaultKey) {
        return {};
      }
    } else {
      const masked: Record<string, any> = {};
      for (const key of Object.keys(vaultEnvironmentData)) {
        masked[key] = models.environment.vaultEnvironmentMaskValue;
      }
      return masked;
    }
  }
  return vaultEnvironmentData;
}
