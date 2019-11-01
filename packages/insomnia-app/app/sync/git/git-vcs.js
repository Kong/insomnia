// @flow
import * as git from 'isomorphic-git';
import path from 'path';

export type GitAuthor = {|
  name: string,
  email: string,
|};

export type GitRemoteConfig = {|
  remote: string,
  url: string,
|};

type GitCredentialsPassword = {
  username: string,
  password: string,
};

type GitCredentialsToken = {
  token: string,
};

export type GitCredentials = GitCredentialsPassword | GitCredentialsToken;

export type GitLogEntry = {|
  oid: string,
  message: string,
  tree: string,
  author: GitAuthor & {
    timestamp: number,
  },
|};

type GitStatusState =
  | 'ignored'
  | 'unmodified'
  | '*modified'
  | '*deleted'
  | '*added'
  | 'absent'
  | 'modified'
  | 'deleted'
  | 'added'
  | '*unmodified'
  | '*absent';

export type GitStatusEntry = {
  path: string,
  status: GitStatusState,
};

export type GitStatus = {
  hasChanges: boolean,
  allStaged: boolean,
  allUnstaged: boolean,
  entries: Array<GitStatusEntry>,
};

const STATUS_MAP: { [string]: GitStatusState } = {
  '0 0 3': '*deleted', // added, staged, with unstaged changes
  '0 2 0': '*added',
  '0 2 2': 'added', // added, staged
  '0 2 3': '*added', // added, staged, with unstaged changes
  '1 0 0': 'deleted', // deleted, staged
  '1 0 1': '*deleted', // deleted, unstaged
  '1 1 0': '*deleted', // deleted + ??
  '1 1 1': 'unmodified', // unmodified
  '1 2 1': '*modified', // modified, unstaged
  '1 2 2': 'modified', // modified, staged
  '1 2 3': '*modified', // modified, staged, with unstaged changes
};

export default class GitVCS {
  _git: Object;
  _baseOpts: { dir: string, gitdir?: string };
  _initialized: boolean;

  constructor() {
    this._initialized = false;
  }

  async init(directory: string, fsPlugin: Object, gitDirectory?: string) {
    // Default gitDirectory to <directory>/.git
    gitDirectory = gitDirectory || path.join(directory, '.git');

    this._git = git;
    git.plugins.set('fs', fsPlugin);

    this._baseOpts = { dir: directory, gitdir: gitDirectory };

    if (await this._repoExists()) {
      console.log(`[git] Opened repo for ${gitDirectory}`);
    } else {
      console.log(`[git] Initialized repo in ${gitDirectory}`);
      await git.init({ ...this._baseOpts });
    }

    await this._ensureMasterBranch();
    this._initialized = true;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  async getGitDirectory() {
    return this._baseOpts.gitdir;
  }

  async listFiles(): Promise<Array<string>> {
    console.log('[git] List files');
    return git.listFiles({ ...this._baseOpts });
  }

  async getBranch(): Promise<string> {
    const branch = await git.currentBranch({ ...this._baseOpts });
    if (typeof branch !== 'string') {
      throw new Error('No active branch');
    }

    return branch;
  }

  async listBranches(): Promise<Array<string>> {
    return GitVCS._sortBranches(await git.listBranches({ ...this._baseOpts }));
  }

  async listRemoteBranches(): Promise<Array<string>> {
    const branches = await git.listBranches({ ...this._baseOpts, remote: 'origin' });

    // Don't care about returning remote HEAD
    return GitVCS._sortBranches(branches.filter(b => b !== 'HEAD'));
  }

  async status(): Promise<GitStatus> {
    console.log('[git] Status');
    const matrix = await git.statusMatrix({
      ...this._baseOpts,

      // Only check for .studio because we don't want to accidentally commit
      // anything other files that may exist in the repo.
      pattern: '.studio/**',
    });

    const status = {
      hasChanges: false,
      allStaged: true,
      allUnstaged: true,
      entries: [],
    };

    for (const m of matrix) {
      const key = m.slice(1).join(' ');
      const s = STATUS_MAP[key] || '??';

      if (s.indexOf('*') === 0) {
        status.allStaged = false;
      } else if (s !== 'unmodified') {
        status.allUnstaged = false;
      }

      if (s !== 'unmodified') {
        status.hasChanges = true;
      }

      status.entries.push({
        path: m[0],
        status: s,
      });
    }

    return status;
  }

  async add(relPath: string): Promise<void> {
    console.log(`[git] Add ${relPath}`);
    return git.add({ ...this._baseOpts, filepath: relPath });
  }

  async remove(relPath: string): Promise<void> {
    console.log(`[git] Remove relPath=${relPath}`);
    return git.remove({ ...this._baseOpts, filepath: relPath });
  }

  async addRemote(url: string): Promise<GitRemoteConfig> {
    console.log(`[git] Add Remote url=${url}`);
    await git.addRemote({ ...this._baseOpts, remote: 'origin', url, force: true });
    const config = await this.getRemote('origin');

    if (config === null) {
      // Should never happen but it's here to make Flow happy
      throw new Error('Remote not found remote=origin');
    }

    return config;
  }

  async listRemotes(): Promise<Array<GitRemoteConfig>> {
    return git.listRemotes({ ...this._baseOpts });
  }

  async getAuthor(): Promise<GitAuthor> {
    const name = await git.config({ ...this._baseOpts, path: 'user.name' });
    const email = await git.config({ ...this._baseOpts, path: 'user.email' });
    return {
      name: name || '',
      email: email || '',
    };
  }

  async setAuthor(name: string, email: string): Promise<void> {
    await git.config({ ...this._baseOpts, path: 'user.name', value: name });
    await git.config({ ...this._baseOpts, path: 'user.email', value: email });
  }

  async getRemote(name: string): Promise<GitRemoteConfig | null> {
    const remotes = await this.listRemotes();
    return remotes.find(r => r.remote === name) || null;
  }

  async commit(message: string): Promise<string> {
    console.log(`[git] Commit "${message}"`);
    return git.commit({ ...this._baseOpts, message });
  }

  /**
   * Check to see whether remote is different than local. This is here because
   * when pushing with isomorphic-git, if the HEAD of local is equal the HEAD
   * of remote, it will fail with a non-fast-forward message.
   *
   * @param creds
   * @returns {Promise<boolean>}
   */
  async canPush(creds?: GitCredentials | null) {
    const branch = await this.getBranch();

    const remote = await this.getRemote('origin');
    if (!remote) {
      throw new Error('Remote not configured');
    }

    const remoteInfo = await git.getRemoteInfo({
      ...this._baseOpts,
      ...creds,
      forPush: true,
      url: remote.url,
    });

    const logs = (await this.log(1)) || [];
    const localHead = logs[0].oid;
    const remoteHead = remoteInfo.refs.heads[branch];
    if (localHead === remoteHead) {
      return false;
    }

    return true;
  }

  async push(creds?: GitCredentials | null, force?: boolean = false): Promise<boolean> {
    console.log(`[git] Push remote=origin force=${force ? 'true' : 'false'}`);

    return git.push({ ...this._baseOpts, remote: 'origin', ...creds, force });
  }

  async pull(creds?: GitCredentials | null): Promise<void> {
    console.log(`[git] Pull remote=origin`, await this.getBranch());

    return git.pull({
      ...this._baseOpts,
      ...creds,
      remote: 'origin',
      singleBranch: true,
      fast: true,
    });
  }

  async merge(theirBranch: string): Promise<void> {
    const ours = await this.getBranch();
    console.log(`[git] Merge ${ours} <-- ${theirBranch}`);
    return git.merge({ ...this._baseOpts, ours, theirs: theirBranch });
  }

  async fetch(
    singleBranch: boolean,
    depth: number | null,
    creds?: GitCredentials | null,
  ): Promise<void> {
    console.log(`[git] Fetch remote=origin`);

    return git.fetch({
      ...this._baseOpts,
      ...creds,
      singleBranch,
      remote: 'origin',
      depth,
      prune: true,
      pruneTags: true,
    });
  }

  async log(depth?: number): Promise<Array<GitLogEntry>> {
    console.log(`[git] Log depth=${depth || '--'}`);
    let err = null;
    let log = [];

    try {
      log = await git.log({ ...this._baseOpts, depth: depth });
    } catch (e) {
      err = e;
    }

    if (err && err.code === 'ResolveRefError') {
      return [];
    }

    if (err) {
      throw err;
    } else {
      return log;
    }
  }

  async branch(branch: string, checkout: boolean = false): Promise<void> {
    await git.branch({ ...this._baseOpts, ref: branch, checkout, remote: 'origin' });
  }

  async deleteBranch(branch: string): Promise<void> {
    if (branch === 'master') {
      throw new Error('Cannot delete master branch');
    }

    await git.deleteBranch({ ...this._baseOpts, ref: branch });
  }

  async checkout(branch: string): Promise<void> {
    console.log('[git] Checkout', { branch });
    const branches = await this.listBranches();

    if (branches.includes(branch)) {
      await git.fastCheckout({ ...this._baseOpts, ref: branch, remote: 'origin' });
    } else {
      await this.branch(branch, true);
    }
  }

  async readObjFromTree(treeOid: string, objPath: string): Object | null {
    try {
      const obj = await git.readObject({
        ...this._baseOpts,
        oid: treeOid,
        filepath: objPath,
        encoding: 'utf8',
      });

      return obj.object;
    } catch (err) {
      return null;
    }
  }

  async _repoExists() {
    try {
      await git.config({ ...this._baseOpts, path: '' });
    } catch (err) {
      return false;
    }

    return true;
  }

  async _ensureMasterBranch() {
    const branches = await this.listBranches();

    // If master doesn't exist, create it
    if (!branches.includes('master')) {
      await this.branch('master');
    }
  }

  static _sortBranches(branches: Array<string>) {
    const newBranches = [...branches];
    newBranches.sort((a: string, b: string) => {
      if (a === 'master') {
        return -1;
      } else if (b === 'master') {
        return 1;
      } else {
        return b > a ? -1 : 1;
      }
    });
    return newBranches;
  }
}
