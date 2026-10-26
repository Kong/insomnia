import type * as insomniaData from 'insomnia-data';
import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitLabProvider } from '../gitlab';

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

function mockGitlabApi(email = 'user@example.com') {
  return vi.fn((input: unknown) => {
    const url = String(input);

    if (url.includes('/v1/oauth/gitlab/config')) {
      return jsonResponse({ applicationId: 'client-id', redirectUri: 'https://app.insomnia.rest/oauth/gitlab' });
    }
    if (url.includes('/oauth/token')) {
      return jsonResponse({ access_token: 'access-token', refresh_token: 'refresh-token' });
    }
    if (url.endsWith('/user/emails')) {
      return jsonResponse([{ email }]);
    }
    if (url.endsWith('/user')) {
      return jsonResponse({ id: 1, username: 'octocat', name: 'Octo Cat', avatar_url: 'avatar-url', email });
    }

    return Promise.resolve({ ok: false, statusText: 'not found' } as Response);
  });
}

function makeProvider() {
  return new GitLabProvider({
    type: 'gitlab',
    displayName: 'GitLab',
    instanceUrl: 'https://gitlab.com',
    apiUrl: 'https://gitlab.com/api/v4',
  });
}

describe('GitLabProvider OAuth create-vs-update', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { net } = await import('electron');
    vi.mocked(net.fetch).mockImplementation(mockGitlabApi());
    // completeOAuth reads `._id` off whatever create()/update() resolve to
    // (to reset renewal tracking), regardless of which branch ran.
    vi.mocked(services.gitCredentials.create).mockResolvedValue({ _id: 'git_creds_created' } as never);
    vi.mocked(services.gitCredentials.update).mockResolvedValue({ _id: 'git_creds_updated' } as never);
  });

  it('creates a new credential when "Add Credential" is used, without looking up any existing one', async () => {
    const provider = makeProvider();
    const { state } = await provider.initiateOAuth();

    const result = await provider.completeOAuth('some-code', state);

    expect(result.success).toBe(true);
    expect(services.gitCredentials.getById).not.toHaveBeenCalled();
    expect(services.gitCredentials.create).toHaveBeenCalledTimes(1);
    expect(services.gitCredentials.create).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'gitlab' }),
    );
    expect(services.gitCredentials.update).not.toHaveBeenCalled();
  });

  it('creates a second, distinct credential when a different account is authorized via "Add Credential"', async () => {
    const provider = makeProvider();
    const { net } = await import('electron');

    vi.mocked(net.fetch).mockImplementation(mockGitlabApi('account-a@example.com'));
    const { state: stateA } = await provider.initiateOAuth();
    await provider.completeOAuth('code-a', stateA);

    vi.mocked(net.fetch).mockImplementation(mockGitlabApi('account-b@example.com'));
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
      provider: 'gitlab',
      name: 'GitLab Credential',
      author: { email: 'old@example.com', name: 'Old', avatarUrl: '' },
      credentials: { token: 'old-token', refreshToken: 'old-refresh', emails: [], selectedEmail: 'old@example.com' },
    };
    vi.mocked(services.gitCredentials.getById).mockResolvedValue(existing as never);
    vi.mocked(services.gitCredentials.update).mockResolvedValue(existing as never);

    const { state } = await provider.initiateOAuth(existing._id);
    const result = await provider.completeOAuth('some-code', state);

    expect(result.success).toBe(true);
    expect(services.gitCredentials.getById).toHaveBeenCalledWith(existing._id);
    expect(services.gitCredentials.update).toHaveBeenCalledTimes(1);
    expect(services.gitCredentials.update).toHaveBeenCalledWith(
      existing,
      expect.objectContaining({
        credentials: expect.objectContaining({ token: 'access-token', refreshToken: 'refresh-token' }),
      }),
    );
    expect(services.gitCredentials.create).not.toHaveBeenCalled();
  });

  it('falls back to creating a new credential if the reauthorized credentialId no longer exists', async () => {
    const provider = makeProvider();
    vi.mocked(services.gitCredentials.getById).mockResolvedValue(null);
    vi.mocked(services.gitCredentials.create).mockResolvedValue({ _id: 'git_creds_new' } as never);

    const { state } = await provider.initiateOAuth('git_creds_deleted');
    await provider.completeOAuth('some-code', state);

    expect(services.gitCredentials.getById).toHaveBeenCalledWith('git_creds_deleted');
    expect(services.gitCredentials.create).toHaveBeenCalledTimes(1);
    expect(services.gitCredentials.update).not.toHaveBeenCalled();
  });

  it('falls back to creating a new credential if the reauthorized id belongs to a different provider', async () => {
    const provider = makeProvider();
    const githubCredential = {
      _id: 'git_creds_github',
      type: 'GitCredentials',
      provider: 'github',
      name: 'GitHub Credential',
      author: { email: 'gh@example.com', name: 'GH', avatarUrl: '' },
      credentials: { token: 'gh-token' },
    };
    vi.mocked(services.gitCredentials.getById).mockResolvedValue(githubCredential as never);
    vi.mocked(services.gitCredentials.create).mockResolvedValue({ _id: 'git_creds_new' } as never);

    const { state } = await provider.initiateOAuth(githubCredential._id);
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
