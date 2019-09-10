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
  '0 2 0': '*added',
  '0 2 2': 'added', // added, staged
  '0 2 3': '*added', // added, staged, with unstaged changes
  '1 1 1': 'unmodified', // unmodified
  '1 2 1': '*modified', // modified, unstaged
  '1 2 2': 'modified', // modified, staged
  '1 2 3': '*modified', // modified, staged, with unstaged changes
  '1 0 1': '*deleted', // deleted, unstaged
  '1 0 0': 'deleted', // deleted, staged
};

export default class GitVCS {
  _git: Object;
  _baseOpts: { dir: string, gitdir?: string };

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
  }

  async getGitDirectory() {
    return this._baseOpts.gitdir;
  }

  async listFiles(): Promise<Array<string>> {
    console.log('[git] List files');
    return git.listFiles({ ...this._baseOpts });
  }

  async branch(): Promise<string> {
    const branch = await git.currentBranch({ ...this._baseOpts });
    if (typeof branch !== 'string') {
      throw new Error('No active branch');
    }

    return branch;
  }

  async status(path?: string): Promise<GitStatus> {
    console.log('[git] Status');
    const matrix = await git.statusMatrix({ ...this._baseOpts, pattern: path });
    const status = {
      hasChanges: false,
      allStaged: true,
      allUnstaged: true,
      entries: [],
    };

    for (const m of matrix) {
      const s = STATUS_MAP[m.slice(1).join(' ')];
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

  async addRemote(name: string, url: string): Promise<GitRemoteConfig> {
    console.log(`[git] Add Remote name=${name} url=${url}`);
    await git.addRemote({ ...this._baseOpts, remote: name, url, force: true });
    const config = await this.getRemote(name);

    if (config === null) {
      // Should never happen but it's here to make Flow happy
      throw new Error('Remote not found ' + name);
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

  async push(remote: string, token?: string | null): Promise<Object> {
    console.log(`[git] Push remote=${remote} token=${(token || '').replace(/./g, '*')}`);
    return git.push({ ...this._baseOpts, remote, token, force: true });
  }

  async pull(remote: string, token?: string | null): Promise<void> {
    console.log(`[git] Pull remote=${remote} token=${(token || '').replace(/./g, '*')}`);

    return git.pull({ ...this._baseOpts, remote, token, singleBranch: true });
  }

  async log(depth: number = 5): Promise<Array<GitLogEntry> | null> {
    console.log(`[git] Log depth=${depth}`);
    let err = null;
    let log = null;

    try {
      log = await git.log({ ...this._baseOpts, depth: depth });
    } catch (e) {
      err = e;
    }

    if (err && err.code === 'ResolveRefError') {
      return null;
    }

    if (err) {
      throw err;
    } else {
      return log;
    }
  }

  async checkout(branch: string): Promise<void> {
    console.log('[git] Checkout', { branch });
    try {
      return await git.checkout({ ...this._baseOpts, ref: branch });
    } catch (err) {
      // Create if doesn't exist
      return git.branch({ ...this._baseOpts, ref: branch, checkout: true });
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
}
