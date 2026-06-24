import { afterEach, describe, expect, it, vi } from 'vitest';

import { addDotGit, ensureGitRepoUrlSuffix, isAzureDevOpsUrl } from '../url-utils';
import { expiresAtFromOAuthExpiresIn } from '../utils';

const links = {
  scp: {
    bare: 'git@github.com:a/b',
    dotGit: 'git@github.com:a/b.git',
  },
  ssh: {
    bare: 'ssh://a@github.com/b',
    dotGit: 'ssh://a@github.com/b.git',
  },
  http: {
    bare: 'http://github.com/a/b',
    dotGit: 'http://github.com/a/b.git',
  },
  https: {
    bare: 'https://github.com/a/b',
    dotGit: 'https://github.com/a/b.git',
  },
};

describe('addDotGit', () => {
  it('adds the .git to bare links', () => {
    expect(addDotGit(links.scp.bare)).toEqual(links.scp.dotGit);
    expect(addDotGit(links.ssh.bare)).toEqual(links.ssh.dotGit);
    expect(addDotGit(links.http.bare)).toEqual(links.http.dotGit);
    expect(addDotGit(links.https.bare)).toEqual(links.https.dotGit);
  });

  it('leaves links that already have .git alone', () => {
    expect(addDotGit(links.scp.dotGit)).toEqual(links.scp.dotGit);
    expect(addDotGit(links.ssh.dotGit)).toEqual(links.ssh.dotGit);
    expect(addDotGit(links.http.dotGit)).toEqual(links.http.dotGit);
    expect(addDotGit(links.https.dotGit)).toEqual(links.https.dotGit);
  });
});

describe('isAzureDevOpsUrl', () => {
  it('detects Azure DevOps hosts and the /_git/ path marker', () => {
    expect(isAzureDevOpsUrl('https://dev.azure.com/declankeane/SE-Repo/_git/SE-Repo')).toBe(true);
    expect(isAzureDevOpsUrl('https://declankeane.visualstudio.com/SE-Repo/_git/SE-Repo')).toBe(true);
    // self-hosted Azure DevOps Server identified by the /_git/ marker
    expect(isAzureDevOpsUrl('https://tfs.mycompany.com/collection/project/_git/repo')).toBe(true);
  });

  it('returns false for other providers and invalid input', () => {
    expect(isAzureDevOpsUrl('https://github.com/a/b')).toBe(false);
    expect(isAzureDevOpsUrl('https://gitlab.com/a/b.git')).toBe(false);
    expect(isAzureDevOpsUrl('not a url')).toBe(false);
  });
});

describe('ensureGitRepoUrlSuffix', () => {
  it('appends .git for GitHub/GitLab-style URLs', () => {
    expect(ensureGitRepoUrlSuffix('https://github.com/a/b')).toEqual('https://github.com/a/b.git');
    expect(ensureGitRepoUrlSuffix('https://github.com/a/b.git')).toEqual('https://github.com/a/b.git');
  });

  it('trims trailing slashes before appending', () => {
    expect(ensureGitRepoUrlSuffix('https://github.com/a/b/')).toEqual('https://github.com/a/b.git');
  });

  it('does not append .git for Azure DevOps URLs', () => {
    const azure = 'https://dev.azure.com/declankeane/SE-Repo/_git/SE-Repo';
    expect(ensureGitRepoUrlSuffix(azure)).toEqual(azure);
  });

  it('handles empty/whitespace input', () => {
    expect(ensureGitRepoUrlSuffix('   ')).toEqual('');
  });
});

describe('expiresAtFromOAuthExpiresIn', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an absolute timestamp for valid positive seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const expectedNow = Date.now();
    expect(expiresAtFromOAuthExpiresIn(30)).toBe(expectedNow + 30 * 1000);
    // Floors fractional values to whole seconds before conversion.
    expect(expiresAtFromOAuthExpiresIn(1.9)).toBe(expectedNow + 1 * 1000);
  });

  it('returns undefined for invalid values', () => {
    expect(expiresAtFromOAuthExpiresIn()).toBeUndefined();
    expect(expiresAtFromOAuthExpiresIn(0)).toBeUndefined();
    expect(expiresAtFromOAuthExpiresIn(-1)).toBeUndefined();
    expect(expiresAtFromOAuthExpiresIn(Number.NaN)).toBeUndefined();
    expect(expiresAtFromOAuthExpiresIn(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
