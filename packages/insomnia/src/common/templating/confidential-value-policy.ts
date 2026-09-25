import { EXTERNAL_VAULT_PLUGIN_NAME } from '~/common/constants';

import type { RenderPurpose } from './types';

export type ConfidentialValueKind = 'normal' | 'secret' | 'external-vault';
export type ConfidentialValuePolicy =
  // Use the real plaintext value (send, script, or preview with setting OFF).
  | 'reveal'
  // Replace the value with •••••• before it reaches any display surface or log (preview with setting ON).
  | 'mask';

// The string displayed in place of a masked confidential value across all surfaces.
export const CONFIDENTIAL_MASK_VALUE = '••••••';

// Tag name for the bundled external vault plugin, used to intercept tag execution
// at the adapter boundary before any provider fetch occurs.
const BUNDLED_EXTERNAL_VAULT_TAG = 'vault';

export function isExternalVaultTag(pluginName: string, tagName: string | undefined): boolean {
  return pluginName === EXTERNAL_VAULT_PLUGIN_NAME && tagName === BUNDLED_EXTERNAL_VAULT_TAG;
}

export function getConfidentialValuePolicy({
  purpose,
  hideSecretValues,
  forceReveal,
}: {
  purpose?: RenderPurpose;
  hideSecretValues?: boolean;
  forceReveal?: boolean;
}): ConfidentialValuePolicy {
  if (purpose === 'send' || purpose === 'script') {
    return 'reveal';
  }

  if (purpose === 'preview') {
    // forceReveal is set by the VariableEditor eye-button; it only applies to the preview
    // surface so that codegen and fallback surfaces remain unaffected.
    return forceReveal || hideSecretValues === false ? 'reveal' : 'mask';
  }

  // Fail-closed: any surface that does not explicitly declare its purpose is masked.
  // All known display surfaces (preview, send, script) are explicit above.
  return 'mask';
}

/**
 * Returns true when the external vault tag's run() should be skipped and CONFIDENTIAL_MASK_VALUE
 * returned instead, avoiding any provider fetch.
 *
 * Only intercepts the 'preview' purpose. Generate Code and Copy as cURL callers use
 * purpose:'preview' so they are covered here. For 'general', undefined, and other purposes
 * the plugin's own run() handles its behavior.
 */
export function shouldMaskExternalVaultTag(
  pluginName: string,
  tagName: string | undefined,
  renderPurpose: RenderPurpose | undefined,
  settings: { hideSecretValuesInPreviewAndConsole?: boolean; forceReveal?: boolean } | undefined,
): boolean {
  if (pluginName !== EXTERNAL_VAULT_PLUGIN_NAME || tagName !== BUNDLED_EXTERNAL_VAULT_TAG) {
    return false;
  }
  if (renderPurpose !== 'preview') {
    return false;
  }
  return (
    getConfidentialValuePolicy({
      purpose: renderPurpose,
      hideSecretValues: settings?.hideSecretValuesInPreviewAndConsole,
      forceReveal: settings?.forceReveal,
    }) === 'mask'
  );
}
