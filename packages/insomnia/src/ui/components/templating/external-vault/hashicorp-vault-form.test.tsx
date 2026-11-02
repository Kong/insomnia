/**
 * @vitest-environment jsdom
 */
import type { PluginData } from 'insomnia-data';
import { models } from 'insomnia-data';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NunjucksParsedTag } from '~/common/templating/types';

import { HashiCorpVaultForm } from './hashicorp-vault-form';
import type { HashiCorpSecretConfig } from './types';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const { HashiCorpCredentialType } = models.cloudCredential;

const mockRootLoaderData = vi.hoisted(() => ({ cloudCredentials: [] as unknown[] }));

vi.mock('~/ui/hooks/use-root-loader-data', () => ({
  useRootLoaderData: () => mockRootLoaderData,
}));

vi.mock('../../help-tooltip', () => ({
  HelpTooltip: () => null,
}));

const credentialId = `${models.cloudCredential.prefix}_hashicorp`;
const pluginDataKey = 'tag-unique-key';

const buildCredential = (type: string) => ({
  _id: credentialId,
  provider: 'hashicorp',
  credentials: { type },
});

const buildTag = (credentialIdOrKey: string) =>
  ({
    args: [{ value: 'hashicorp' }, { value: credentialIdOrKey }],
  }) as unknown as NunjucksParsedTag;

const buildPluginData = (key: string, value: string) => ({ key, value }) as unknown as PluginData;

describe('HashiCorpVaultForm', () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (credentialIdOrKey: string, vaultPluginData: PluginData[] = []) => {
    act(() => {
      root.render(
        <HashiCorpVaultForm
          formData={{} as HashiCorpSecretConfig}
          onChange={vi.fn()}
          activeTagData={buildTag(credentialIdOrKey)}
          vaultPluginData={vaultPluginData}
        />,
      );
    });
  };

  const hasField = (name: string) => Boolean(container.querySelector(`input[name="${name}"]`));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mockRootLoaderData.cloudCredentials = [];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('legacy tag (cloud credential id stored in the tag)', () => {
    it('renders the on-prem fields', () => {
      mockRootLoaderData.cloudCredentials = [buildCredential(HashiCorpCredentialType.onPrem)];

      render(credentialId);

      expect(hasField('secretEnginePath')).toBe(true);
      expect(hasField('secretName')).toBe(true);
      expect(hasField('secretKey')).toBe(true);
      expect(hasField('organizationId')).toBe(false);
    });

    it('renders nothing when the credential does not exist', () => {
      render(credentialId);

      expect(container.innerHTML).toBe('');
    });
  });

  describe('new tag (cloud credential id stored in plugin data under the tag key)', () => {
    it('resolves the credential id from plugin data and renders the on-prem fields', () => {
      mockRootLoaderData.cloudCredentials = [buildCredential(HashiCorpCredentialType.onPrem)];

      render(pluginDataKey, [buildPluginData(pluginDataKey, credentialId)]);

      expect(hasField('secretEnginePath')).toBe(true);
      expect(hasField('secretName')).toBe(true);
      expect(hasField('secretKey')).toBe(true);
    });

    it('renders the HCP Vault Dedicated fields including the namespace option', () => {
      mockRootLoaderData.cloudCredentials = [buildCredential(HashiCorpCredentialType.cloudVaultDedicated)];

      render(pluginDataKey, [buildPluginData(pluginDataKey, credentialId)]);

      expect(hasField('secretEnginePath')).toBe(true);
      expect(container.textContent).toContain('Send Namespace Via Header');
    });

    it('renders the HCP Vault Secrets fields', () => {
      mockRootLoaderData.cloudCredentials = [buildCredential(HashiCorpCredentialType.cloudVaultSecrets)];

      render(pluginDataKey, [buildPluginData(pluginDataKey, credentialId)]);

      expect(hasField('organizationId')).toBe(true);
      expect(hasField('projectId')).toBe(true);
      expect(hasField('appName')).toBe(true);
      expect(hasField('secretEnginePath')).toBe(false);
    });

    it('ignores plugin data stored under a different key', () => {
      mockRootLoaderData.cloudCredentials = [buildCredential(HashiCorpCredentialType.onPrem)];

      render(pluginDataKey, [buildPluginData('another-key', credentialId)]);

      expect(container.innerHTML).toBe('');
    });

    it('renders nothing when plugin data is empty', () => {
      mockRootLoaderData.cloudCredentials = [buildCredential(HashiCorpCredentialType.onPrem)];

      render(pluginDataKey, []);

      expect(container.innerHTML).toBe('');
    });

    it('renders nothing when the credential referenced by plugin data no longer exists', () => {
      render(pluginDataKey, [buildPluginData(pluginDataKey, credentialId)]);

      expect(container.innerHTML).toBe('');
    });
  });
});
