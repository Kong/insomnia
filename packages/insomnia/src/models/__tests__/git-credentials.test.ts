import { describe, expect, it } from 'vitest';

import { type BaseGitCredentialsV2, models, services } from '~/insomnia-data';

const { init, isGitCredentialsV2, supportsRenewal } = models.gitCredentials;

describe('init()', () => {
  it('contains all required fields with correct default values', async () => {
    const defaults = init();

    // Batch validate all fields and their default values
    expect(defaults).toEqual({
      name: '',
      provider: undefined,
      credentials: undefined, // Must exist for initModel() to preserve it
      author: {
        email: '',
        name: '',
        avatarUrl: '',
      },
      token: undefined,
      refreshToken: undefined,
    });

    // Verify all expected keys exist
    const expectedKeys = ['name', 'provider', 'credentials', 'author', 'token', 'refreshToken'];
    expect(Object.keys(defaults)).toEqual(expect.arrayContaining(expectedKeys));
  });
});

describe('create()', () => {
  it('creates a github credential and persists all nested fields', async () => {
    const githubCredential: BaseGitCredentialsV2 = {
      name: 'My GitHub Account',
      provider: 'github',
      author: {
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: 'https://github.com/avatar.png',
      },
      credentials: {
        token: 'ghp_test_token_123',
        refreshToken: '',
        expiresAt: 1_234_567_890,
        scopes: ['repo', 'user'],
        emails: [{ email: 'test@example.com', primary: true, verified: true }],
        selectedEmail: 'test@example.com',
      },
    };

    const created = await services.gitCredentials.create(githubCredential);

    // Verify id format and timestamps
    expect(created._id).toMatch(/^git_creds_/);
    expect(created.modified).toBeDefined();
    expect(created.created).toBeDefined();

    // Verify all fields including nested credentials
    expect(created).toMatchObject({
      type: 'GitCredentials',
      provider: 'github',
      name: 'My GitHub Account',
      author: {
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: 'https://github.com/avatar.png',
      },
      credentials: {
        token: 'ghp_test_token_123',
        refreshToken: '',
        expiresAt: 1_234_567_890,
        scopes: ['repo', 'user'],
        emails: [{ email: 'test@example.com', primary: true, verified: true }],
        selectedEmail: 'test@example.com',
      },
    });

    // Verify persistence: retrieve from database and check all nested fields
    const retrieved = await services.gitCredentials.getById(created._id);
    expect(retrieved).toMatchObject(created);

    // Verify type guard and renewal support
    expect(isGitCredentialsV2(created)).toBe(true);
    expect(supportsRenewal(created)).toBe(false);
  });

  it('creates a gitlab credential and persists all nested fields', async () => {
    const gitlabCredential: BaseGitCredentialsV2 = {
      name: 'My GitLab Account',
      provider: 'gitlab',
      author: {
        name: 'GitLab User',
        email: 'gitlab@example.com',
        avatarUrl: 'https://gitlab.com/avatar.png',
      },
      credentials: {
        token: 'glpat_test_token_789',
        refreshToken: 'gitlab_refresh_token_abc',
        expiresAt: 9_876_543_210,
        emails: [
          { email: 'gitlab@example.com', primary: true, verified: true },
          { email: 'secondary@example.com', primary: false, verified: true },
        ],
        selectedEmail: 'gitlab@example.com',
      },
    };

    const created = await services.gitCredentials.create(gitlabCredential);

    expect(created._id).toMatch(/^git_creds_/);
    expect(created).toMatchObject({
      type: 'GitCredentials',
      provider: 'gitlab',
      name: 'My GitLab Account',
      author: {
        name: 'GitLab User',
        email: 'gitlab@example.com',
        avatarUrl: 'https://gitlab.com/avatar.png',
      },
      credentials: {
        token: 'glpat_test_token_789',
        refreshToken: 'gitlab_refresh_token_abc',
        expiresAt: 9_876_543_210,
        emails: [
          { email: 'gitlab@example.com', primary: true, verified: true },
          { email: 'secondary@example.com', primary: false, verified: true },
        ],
        selectedEmail: 'gitlab@example.com',
      },
    });

    // Verify persistence
    const retrieved = await services.gitCredentials.getById(created._id);
    expect(retrieved).toMatchObject(created);

    expect(isGitCredentialsV2(created)).toBe(true);
    expect(supportsRenewal(created)).toBe(true);
  });

  it('creates a custom credential and persists all nested fields', async () => {
    const customCredential: BaseGitCredentialsV2 = {
      name: 'My Custom Git Server',
      provider: 'custom',
      author: {
        name: 'Custom User',
        email: 'custom@example.com',
        avatarUrl: 'https://custom.example.com/avatar.png',
      },
      credentials: {
        username: 'myusername',
        password: 'my_personal_access_token',
        baseURI: 'https://git.mycompany.com',
      },
    };

    const created = await services.gitCredentials.create(customCredential);

    expect(created._id).toMatch(/^git_creds_/);
    expect(created).toMatchObject({
      type: 'GitCredentials',
      provider: 'custom',
      name: 'My Custom Git Server',
      author: {
        name: 'Custom User',
        email: 'custom@example.com',
        avatarUrl: 'https://custom.example.com/avatar.png',
      },
      credentials: {
        username: 'myusername',
        password: 'my_personal_access_token',
        baseURI: 'https://git.mycompany.com',
      },
    });

    // Verify persistence
    const retrieved = await services.gitCredentials.getById(created._id);
    expect(retrieved).toMatchObject(created);

    expect(isGitCredentialsV2(created)).toBe(true);
    expect(supportsRenewal(created)).toBe(false); // Custom doesn't support renewal
  });
});

describe('getById()', () => {
  it('returns null for non-existent id', async () => {
    const retrieved = await services.gitCredentials.getById('git_creds_nonexistent');
    expect(retrieved).toBeNull();
  });
});

describe('update()', () => {
  it('updates and persists credential changes', async () => {
    const credential = await services.gitCredentials.create({
      name: 'Original Name',
      provider: 'github',
      author: { name: 'Original User', email: 'original@example.com' },
      credentials: { token: 'original_token', scopes: ['repo'] },
    });

    const updated = await services.gitCredentials.update(credential, {
      name: 'Updated Name',
      credentials: {
        token: 'updated_token',
        refreshToken: 'new_refresh_token',
        scopes: ['repo', 'user'],
        expiresAt: 1_234_567_890,
      },
    });

    // Verify updated fields and preserved original fields
    expect(updated).toMatchObject({
      name: 'Updated Name',
      credentials: {
        token: 'updated_token',
        refreshToken: 'new_refresh_token',
        scopes: ['repo', 'user'],
        expiresAt: 1_234_567_890,
      },
      author: { email: 'original@example.com' },
    });

    // Verify persistence
    const retrieved = await services.gitCredentials.getById(updated._id);
    expect(retrieved).toMatchObject(updated);
  });
});

describe('type guards', () => {
  it('isGitCredentialsV2 correctly identifies V2 credentials', async () => {
    const created = await services.gitCredentials.create({
      name: 'V2 Credential',
      provider: 'github',
      author: { name: 'User', email: 'user@example.com' },
      credentials: { token: 'test' },
    });
    expect(isGitCredentialsV2(created)).toBe(true);
  });

  it('supportsRenewal returns correct values for different providers', async () => {
    // GitHub with refreshToken supports renewal
    const githubWithRefresh = await services.gitCredentials.create({
      name: 'GitHub',
      provider: 'github',
      author: { name: 'User', email: 'user@example.com' },
      credentials: { token: 'test', refreshToken: 'refresh' },
    });
    expect(supportsRenewal(githubWithRefresh)).toBe(true);

    // GitHub without refreshToken doesn't support renewal
    const githubWithoutRefresh = await services.gitCredentials.create({
      name: 'GitHub No Refresh',
      provider: 'github',
      author: { name: 'User', email: 'user@example.com' },
      credentials: { token: 'test' },
    });
    expect(supportsRenewal(githubWithoutRefresh)).toBe(false);

    // GitLab with refreshToken supports renewal
    const gitlabWithRefresh = await services.gitCredentials.create({
      name: 'GitLab',
      provider: 'gitlab',
      author: { name: 'User', email: 'user@example.com' },
      credentials: { token: 'test', refreshToken: 'refresh' },
    });
    expect(supportsRenewal(gitlabWithRefresh)).toBe(true);

    // Custom never supports renewal
    const custom = await services.gitCredentials.create({
      name: 'Custom',
      provider: 'custom',
      author: { name: 'User', email: 'user@example.com' },
      credentials: { username: 'user', password: 'pass' },
    });
    expect(supportsRenewal(custom)).toBe(false);
  });
});

describe('all() and remove()', () => {
  it('lists and removes credentials', async () => {
    await services.gitCredentials.removeAll();

    const cred1 = await services.gitCredentials.create({
      name: 'Credential 1',
      provider: 'github',
      author: { name: 'User', email: 'user@example.com' },
      credentials: { token: 'token1' },
    });

    const cred2 = await services.gitCredentials.create({
      name: 'Credential 2',
      provider: 'gitlab',
      author: { name: 'User', email: 'user@example.com' },
      credentials: { token: 'token2', refreshToken: 'refresh2' },
    });

    // Verify all() returns both
    let allCreds = await services.gitCredentials.all();
    expect(allCreds.length).toBe(2);

    // Remove one and verify
    await services.gitCredentials.remove(cred1);
    allCreds = await services.gitCredentials.all();
    expect(allCreds.length).toBe(1);
    expect(allCreds[0]._id).toBe(cred2._id);

    await services.gitCredentials.removeAll();
  });
});
