import { describe, expect, it } from 'vitest';

import { type ConfidentialValuePolicy, getConfidentialValuePolicy, shouldMaskExternalVaultTag } from './confidential-value-policy';
import type { RenderPurpose } from './types';

const purposes: (RenderPurpose | undefined)[] = [
  undefined,
  'general',
  'send',
  'preview',
  'script',
  'no-render',
];
const settings = [true, false, undefined];

function expectedPolicy(
  purpose: RenderPurpose | undefined,
  hideSecretValues: boolean | undefined,
): ConfidentialValuePolicy {
  if (purpose === 'send' || purpose === 'script') {
    return 'reveal';
  }

  if (purpose === 'preview') {
    return hideSecretValues === false ? 'reveal' : 'mask';
  }

  return 'mask';
}

describe('getConfidentialValuePolicy', () => {
  it.each(purposes.flatMap(purpose => settings.map(hideSecretValues => ({ purpose, hideSecretValues }))))(
    'purpose=$purpose hideSecretValues=$hideSecretValues follows the policy matrix',
    ({ purpose, hideSecretValues }) => {
      expect(getConfidentialValuePolicy({ purpose, hideSecretValues })).toBe(
        expectedPolicy(purpose, hideSecretValues),
      );
    },
  );

  it('forceReveal only applies to preview — fallback surfaces ignore it', () => {
    expect(getConfidentialValuePolicy({ purpose: 'preview', forceReveal: true })).toBe('reveal');
    expect(getConfidentialValuePolicy({ purpose: undefined, forceReveal: true })).toBe('mask');
    expect(getConfidentialValuePolicy({ purpose: 'general', forceReveal: true })).toBe('mask');
  });
});

describe('shouldMaskExternalVaultTag', () => {
  const PLUGIN = '@kong/insomnia-plugin-external-vault';
  const TAG = 'vault';

  it('returns false for non-vault plugin', () => {
    expect(shouldMaskExternalVaultTag({ pluginName: 'other-plugin', tagName: TAG, renderPurpose: 'preview', settings: { hideSecretValuesInPreviewAndConsole: true } })).toBe(false);
  });

  it('returns false for non-vault tag name', () => {
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: 'other-tag', renderPurpose: 'preview', settings: { hideSecretValuesInPreviewAndConsole: true } })).toBe(false);
  });

  it('returns false for non-preview purposes — plugin run() handles its own placeholder', () => {
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, renderPurpose: 'send', settings: { hideSecretValuesInPreviewAndConsole: true } })).toBe(false);
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, renderPurpose: 'script', settings: { hideSecretValuesInPreviewAndConsole: true } })).toBe(false);
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, settings: { hideSecretValuesInPreviewAndConsole: true } })).toBe(false);
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, renderPurpose: 'general', settings: { hideSecretValuesInPreviewAndConsole: true } })).toBe(false);
  });

  it('returns true for preview when setting is ON (default-closed)', () => {
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, renderPurpose: 'preview', settings: { hideSecretValuesInPreviewAndConsole: true } })).toBe(true);
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, renderPurpose: 'preview', settings: {} })).toBe(true);
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, renderPurpose: 'preview' })).toBe(true);
  });

  it('returns false for preview when setting is OFF — reveal real value', () => {
    expect(shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, renderPurpose: 'preview', settings: { hideSecretValuesInPreviewAndConsole: false } })).toBe(false);
  });

  it('returns false for preview when forceReveal is true — eye-button reveal bypasses setting', () => {
    expect(
      shouldMaskExternalVaultTag({ pluginName: PLUGIN, tagName: TAG, renderPurpose: 'preview', settings: { hideSecretValuesInPreviewAndConsole: true, forceReveal: true } }),
    ).toBe(false);
  });
});
