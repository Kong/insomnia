import { afterEach, describe, expect, it, vi } from 'vitest';

import { addDotGit, expiresAtFromOAuthExpiresIn } from '../utils';

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
