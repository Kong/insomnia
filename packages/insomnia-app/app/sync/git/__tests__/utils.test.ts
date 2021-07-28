import { addDotGit, translateSSHtoHTTP } from '../utils';
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

describe('translateSSHtoHTTP', () => {
  it('fixes up scp-style', () => {
    expect(translateSSHtoHTTP(links.scp.bare)).toEqual(links.https.bare);
    expect(translateSSHtoHTTP(links.scp.dotGit)).toEqual(links.https.dotGit);
  });

  it('fixes up ssh-style', () => {
    expect(translateSSHtoHTTP(links.ssh.bare)).toEqual('https://a@github.com/b');
    expect(translateSSHtoHTTP(links.ssh.dotGit)).toEqual('https://a@github.com/b.git');
  });

  it('leaves http alone', () => {
    expect(translateSSHtoHTTP(links.http.bare)).toEqual(links.http.bare);
    expect(translateSSHtoHTTP(links.http.dotGit)).toEqual(links.http.dotGit);
  });

  it('leaves https alone', () => {
    expect(translateSSHtoHTTP(links.https.bare)).toEqual(links.https.bare);
    expect(translateSSHtoHTTP(links.https.dotGit)).toEqual(links.https.dotGit);
  });
});

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
