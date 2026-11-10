import type * as InsomniaData from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('insomnia-data', async importOriginal => {
  const actual = await importOriginal<typeof InsomniaData>();
  return {
    ...actual,
    services: {
      ...actual.services,
      gitCredentials: { ...actual.services.gitCredentials, getById: vi.fn() },
    },
  };
});

import { services } from 'insomnia-data';

import { gitRemoteProviderRegistry } from '~/sync/git/providers';

import { gitCallbacks } from '../utils';

const nativeCredentials = { _id: 'git-creds-native', provider: 'native' };

describe('gitCallbacks', () => {
  const provider = {
    authCallback: vi.fn(),
    authFailureCallback: vi.fn(),
    authSuccessCallback: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(services.gitCredentials.getById).mockResolvedValue(nativeCredentials as any);
    vi.spyOn(gitRemoteProviderRegistry, 'get').mockReturnValue(provider as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    provider.authCallback.mockReset();
    provider.authFailureCallback.mockReset();
    provider.authSuccessCallback.mockReset();
  });

  it('routes auth success to the provider with url, auth and repoPath', async () => {
    const auth = { username: 'user', password: 'token' };

    await gitCallbacks('git-creds-native', '/repo').onAuthSuccess('https://example.com/repo.git', auth);

    expect(provider.authSuccessCallback).toHaveBeenCalledWith(
      nativeCredentials,
      'https://example.com/repo.git',
      auth,
      '/repo',
    );
  });

  it('routes auth failure to the provider with url, auth and repoPath', async () => {
    const auth = { username: 'user', password: 'stale' };
    provider.authFailureCallback.mockResolvedValue({ cancel: true });

    const result = await gitCallbacks('git-creds-native', '/repo').onAuthFailure('https://example.com/repo.git', auth);

    expect(result).toEqual({ cancel: true });
    expect(provider.authFailureCallback).toHaveBeenCalledWith(
      nativeCredentials,
      'https://example.com/repo.git',
      auth,
      '/repo',
    );
  });

  it('does not fail the git operation when the success callback throws', async () => {
    provider.authSuccessCallback.mockRejectedValue(new Error('boom'));

    await expect(
      gitCallbacks('git-creds-native').onAuthSuccess('https://example.com/repo.git', {
        username: 'user',
        password: 'token',
      }),
    ).resolves.toBeUndefined();
  });

  it('skips the success callback when there are no credentials', async () => {
    await gitCallbacks().onAuthSuccess('https://example.com/repo.git', { username: 'user', password: 'token' });

    expect(provider.authSuccessCallback).not.toHaveBeenCalled();
  });
});
