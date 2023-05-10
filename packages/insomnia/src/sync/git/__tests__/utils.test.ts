import { describe, expect, it } from '@jest/globals';

import { addDotGit } from '../utils';

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
