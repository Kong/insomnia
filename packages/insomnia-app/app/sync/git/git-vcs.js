// @flow
import * as git from 'isomorphic-git';
import { trackEvent } from '../../common/analytics';
import { httpPlugin } from './http';

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

/**
 * In order to keep the Git stuff isolated within the repository, we store
 * everything under a single directory at the root. This also gives us a
 * location to look for when cloning a new repository.
 *
 * NOTE: The directory is still named `.studio` because that was the original name.
 *   Changing it would be too difficult at this point.
 */
export const GIT_NAMESPACE_DIR = '.studio';

export default class GitVCS {
  _git: Object;
  _baseOpts: {dir: string, gitdir?: string};
  _initialized: boolean;

  constructor() {
    this._initialized = false;
  }

  async init(directory: string, fsPlugin: Object, gitDirectory: string) {
    this._git = git;
    git.plugins.set('fs', fsPlugin);
    git.plugins.set('http', httpPlugin);

    this._baseOpts = { dir: directory, gitdir: gitDirectory };

    if (await this._repoExists()) {
      console.log(`[git] Opened repo for ${gitDirectory}`);
    } else {
      console.log(`[git] Initialized repo in ${gitDirectory}`);
      await git.init({ ...this._baseOpts });
    }

    this._initialized = true;
  }

  async initFromClone(
    url: string,
    creds: GitCredentials,
    directory: string,
    fsPlugin: Object,
    gitDirectory: string,
  ) {
    this._git = git;
    git.plugins.set('fs', fsPlugin);

    this._baseOpts = { dir: directory, gitdir: gitDirectory };

    await git.clone({ ...this._baseOpts, ...creds, url, singleBranch: true });

    console.log(`[git] Clones repo to ${gitDirectory} from ${url}`);

    this._initialized = true;
  }

  isInitialized(): boolean {
    return this._initialized;
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
    const branch = await this.getBranch();
    const branches = await git.listBranches({ ...this._baseOpts });

    // For some reason, master isn't in branches on fresh repo (no commits)
    if (!branches.includes(branch)) {
      branches.push(branch);
    }

    return GitVCS._sortBranches(branches);
  }

  async listRemoteBranches(): Promise<Array<string>> {
    const branches = await git.listBranches({ ...this._baseOpts, remote: 'origin' });

    // Don't care about returning remote HEAD
    return GitVCS._sortBranches(branches.filter(b => b !== 'HEAD'));
  }

  async status(filepath: string) {
    return git.status({ ...this._baseOpts, filepath });
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
    trackEvent('Git', 'Commit');
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
    const remoteRefs = remoteInfo.refs || {};
    const remoteHeads = remoteRefs.heads || {};
    const remoteHead = remoteHeads[branch];
    if (localHead === remoteHead) {
      return false;
    }

    return true;
  }

  async push(creds?: GitCredentials | null, force?: boolean = false): Promise<boolean> {
    console.log(`[git] Push remote=origin force=${force ? 'true' : 'false'}`);
    trackEvent('Git', 'Push');

    return git.push({ ...this._baseOpts, remote: 'origin', ...creds, force });
  }

  async pull(creds?: GitCredentials | null): Promise<void> {
    console.log('[git] Pull remote=origin', await this.getBranch());
    trackEvent('Git', 'Pull');

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
    trackEvent('Git', 'Merge');
    return git.merge({ ...this._baseOpts, ours, theirs: theirBranch });
  }

  async fetch(
    singleBranch: boolean,
    depth: number | null,
    creds?: GitCredentials | null,
  ): Promise<void> {
    console.log('[git] Fetch remote=origin');

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
    trackEvent('Git', 'Create Branch');
    await git.branch({ ...this._baseOpts, ref: branch, checkout, remote: 'origin' });
  }

  async deleteBranch(branch: string): Promise<void> {
    trackEvent('Git', 'Delete Branch');
    await git.deleteBranch({ ...this._baseOpts, ref: branch });
  }

  async checkout(branch: string): Promise<void> {
    console.log('[git] Checkout', { branch });
    const branches = await this.listBranches();

    if (branches.includes(branch)) {
      trackEvent('Git', 'Checkout Branch');
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

  getFs() {
    return git.plugins.get('fs');
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
