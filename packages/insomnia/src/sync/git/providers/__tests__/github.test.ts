import type * as insomniaData from 'insomnia-data';
import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitHubProvider } from '../github';

// vitest.config.ts aliases 'electron/main' to 'electron', so both `import { shell }
// from 'electron'` and `import { net } from 'electron/main'` resolve to this one mock.
vi.mock('electron', () => ({
  shell: { openExternal: vi.fn(() => Promise.resolve()) },
  net: { fetch: vi.fn() },
}));

vi.mock('insomnia-data', async importOriginal => {
  const actual = await importOriginal<typeof insomniaData>();
  return {
    ...actual,
    services: {
      ...actual.services,
      gitCredentials: {
        getById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

const jsonResponse = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

function mockGithubApi(email = 'user@example.com') {
  return vi.fn((input: unknown) => {
    const url = String(input);

    if (url.includes('/v1/oauth/github-app')) {
      return jsonResponse({ access_token: 'access-token' });
    }
    if (url.endsWith('/user/emails')) {
      return jsonResponse([{ email, primary: true, verified: true }]);
    }
    if (url.endsWith('/user')) {
      return jsonResponse({ id: 1, login: 'octocat', name: 'Octo Cat', email: null, avatar_url: 'avatar-url' });
    }

    return Promise.resolve({ ok: false, statusText: 'not found' } as Response);
  });
}

function makeProvider() {
  return new GitHubProvider({
    type: 'github',
    displayName: 'GitHub',
    apiUrl: 'https://api.github.com',
    webUrl: 'https://github.com',
  });
}

describe('GitHubProvider OAuth create-vs-update', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { net } = await import('electron');
    vi.mocked(net.fetch).mockImplementation(mockGithubApi());
  });

  it('creates a new credential when "Add Credential" is used, without looking up any existing one', async () => {
    const provider = makeProvider();
    const { state } = await provider.initiateOAuth();

    const result = await provider.completeOAuth('some-code', state);

    expect(result.success).toBe(true);
    expect(services.gitCredentials.getById).not.toHaveBeenCalled();
    expect(services.gitCredentials.create).toHaveBeenCalledTimes(1);
    expect(services.gitCredentials.create).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'github' }),
    );
    expect(services.gitCredentials.update).not.toHaveBeenCalled();
  });

  it('creates a second, distinct credential when a different account is authorized via "Add Credential"', async () => {
    const provider = makeProvider();
    const { net } = await import('electron');

    vi.mocked(net.fetch).mockImplementation(mockGithubApi('account-a@example.com'));
    const { state: stateA } = await provider.initiateOAuth();
    await provider.completeOAuth('code-a', stateA);

    vi.mocked(net.fetch).mockImplementation(mockGithubApi('account-b@example.com'));
    const { state: stateB } = await provider.initiateOAuth();
    await provider.completeOAuth('code-b', stateB);

    expect(services.gitCredentials.create).toHaveBeenCalledTimes(2);
    expect(services.gitCredentials.update).not.toHaveBeenCalled();
  });

  it('updates the exact credential being reauthorized when a credentialId is supplied', async () => {
    const provider = makeProvider();
    const existing = {
      _id: 'git_creds_existing',
      type: 'GitCredentials',
      provider: 'github',
      name: 'GitHub Credential',
      author: { email: 'old@example.com', name: 'Old', avatarUrl: '' },
      credentials: { token: 'old-token', emails: [], selectedEmail: 'old@example.com' },
    };
    vi.mocked(services.gitCredentials.getById).mockResolvedValue(existing as never);

    const { state } = await provider.initiateOAuth(existing._id);
    const result = await provider.completeOAuth('some-code', state);

    expect(result.success).toBe(true);
    expect(services.gitCredentials.getById).toHaveBeenCalledWith(existing._id);
    expect(services.gitCredentials.update).toHaveBeenCalledTimes(1);
    expect(services.gitCredentials.update).toHaveBeenCalledWith(
      existing,
      expect.objectContaining({
        credentials: expect.objectContaining({ token: 'access-token' }),
      }),
    );
    expect(services.gitCredentials.create).not.toHaveBeenCalled();
  });

  it('falls back to creating a new credential if the reauthorized credentialId no longer exists', async () => {
    const provider = makeProvider();
    vi.mocked(services.gitCredentials.getById).mockResolvedValue(null);

    const { state } = await provider.initiateOAuth('git_creds_deleted');
    await provider.completeOAuth('some-code', state);

    expect(services.gitCredentials.getById).toHaveBeenCalledWith('git_creds_deleted');
    expect(services.gitCredentials.create).toHaveBeenCalledTimes(1);
    expect(services.gitCredentials.update).not.toHaveBeenCalled();
  });

  it('falls back to creating a new credential if the reauthorized id belongs to a different provider', async () => {
    const provider = makeProvider();
    const gitlabCredential = {
      _id: 'git_creds_gitlab',
      type: 'GitCredentials',
      provider: 'gitlab',
      name: 'GitLab Credential',
      author: { email: 'gl@example.com', name: 'GL', avatarUrl: '' },
      credentials: { token: 'gl-token' },
    };
    vi.mocked(services.gitCredentials.getById).mockResolvedValue(gitlabCredential as never);

    const { state } = await provider.initiateOAuth(gitlabCredential._id);
    await provider.completeOAuth('some-code', state);

    expect(services.gitCredentials.create).toHaveBeenCalledTimes(1);
    expect(services.gitCredentials.update).not.toHaveBeenCalled();
  });

  it('rejects completion with an unrecognized state and does not touch the database', async () => {
    const provider = makeProvider();

    const result = await provider.completeOAuth('some-code', 'unknown-state');

    expect(result.success).toBe(false);
    expect(services.gitCredentials.getById).not.toHaveBeenCalled();
    expect(services.gitCredentials.create).not.toHaveBeenCalled();
    expect(services.gitCredentials.update).not.toHaveBeenCalled();
  });
});
