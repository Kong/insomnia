import * as git from 'isomorphic-git';
import { trackEvent } from '../../common/analytics';
import { httpClient } from './http-client';
import { convertToOsSep, convertToPosixSep } from './path-sep';
import path from 'path';
import { gitCallbacks } from './utils';

export interface GitAuthor {
  name: string;
  email: string;
}

export interface GitRemoteConfig {
  remote: string;
  url: string;
}

interface GitCredentialsPassword {
  username: string;
  password: string;
}

interface GitCredentialsToken {
  username: string;
  token: string;
}

export type GitCredentials = GitCredentialsPassword | GitCredentialsToken;

export type GitHash = string;

export type GitRef = GitHash | string;

export interface GitTimestamp {
  timezoneOffset: number;
  timestamp: number;
}

export interface GitLogEntry {
  oid: string;
  commit: {
    message: string;
    tree: GitRef;
    author: GitAuthor & GitTimestamp;
    committer: GitAuthor & GitTimestamp;
    parent: GitRef[];
  };
  payload: string;
}

interface InitOptions {
  directory: string;
  fs: git.FsClient;
  gitDirectory?: string;
}

interface InitFromCloneOptions {
  url: string;
  gitCredentials?: GitCredentials | null;
  directory: string;
  fs: git.FsClient;
  gitDirectory: string;
}

/**
 * isomorphic-git internally will default an empty ('') clone directory to '.'
 *
 * Ref: https://github.com/isomorphic-git/isomorphic-git/blob/4e66704d05042624bbc78b85ee5110d5ee7ec3e2/src/utils/normalizePath.js#L10
 *
 * We should set this explicitly (even if set to an empty string), because we have other code (such as fs clients and unit tests) that depend on the clone directory.
 */
export const GIT_CLONE_DIR = '.';
const gitInternalDirName = 'git';
export const GIT_INSOMNIA_DIR_NAME = '.insomnia';
export const GIT_INTERNAL_DIR = path.join(GIT_CLONE_DIR, gitInternalDirName);
export const GIT_INSOMNIA_DIR = path.join(GIT_CLONE_DIR, GIT_INSOMNIA_DIR_NAME);

interface BaseOpts {
  dir: string;
  gitdir?: string;
  fs: git.CallbackFsClient | git.PromiseFsClient;
  http: git.HttpClient;
  onMessage: (message: string) => void;
  onAuthFailure: (message: string) => void;
  onAuthSuccess: (message: string) => void;
  onAuth: () => void;
}

export class GitVCS {
  // @ts-expect-error -- TSCONVERSION not initialized with required properties
  _baseOpts: BaseOpts = gitCallbacks();

  initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async init({ directory, fs, gitDirectory }: InitOptions) {
    this._baseOpts = {
      ...this._baseOpts,
      dir: directory,
      gitdir: gitDirectory,
      fs,
      http: httpClient,
    };

    if (await this.repoExists()) {
      console.log(`[git] Opened repo for ${gitDirectory}`);
    } else {
      console.log(`[git] Initialized repo in ${gitDirectory}`);
      await git.init(this._baseOpts);
    }

    this.initialized = true;
  }

  async initFromClone({ url, gitCredentials, directory, fs, gitDirectory }: InitFromCloneOptions) {
    this._baseOpts = {
      ...this._baseOpts,
      ...gitCallbacks(gitCredentials),
      dir: directory,
      gitdir: gitDirectory,
      fs,
      http: httpClient,
    };
    const cloneParams = { ...this._baseOpts, url, singleBranch: true };
    await git.clone(cloneParams);
    console.log(`[git] Clones repo to ${gitDirectory} from ${url}`);
    this.initialized = true;
  }

  isInitialized() {
    return this.initialized;
  }

  async listFiles() {
    console.log('[git] List files');
    const files = await git.listFiles({ ...this._baseOpts });
    return files.map(convertToOsSep);
  }

  async getBranch() {
    const branch = await git.currentBranch({ ...this._baseOpts });

    if (typeof branch !== 'string') {
      throw new Error('No active branch');
    }

    return branch;
  }

  async listBranches() {
    const branch = await this.getBranch();
    const branches = await git.listBranches({ ...this._baseOpts });

    // For some reason, master isn't in branches on fresh repo (no commits)
    if (!branches.includes(branch)) {
      branches.push(branch);
    }

    return GitVCS.sortBranches(branches);
  }

  async listRemoteBranches() {
    const branches = await git.listBranches({ ...this._baseOpts, remote: 'origin' });
    // Don't care about returning remote HEAD
    return GitVCS.sortBranches(branches.filter(b => b !== 'HEAD'));
  }

  async status(filepath: string) {
    return git.status({ ...this._baseOpts, filepath: convertToPosixSep(filepath) });
  }

  async add(relPath: string) {
    relPath = convertToPosixSep(relPath);
    console.log(`[git] Add ${relPath}`);
    return git.add({ ...this._baseOpts, filepath: relPath });
  }

  async remove(relPath: string) {
    relPath = convertToPosixSep(relPath);
    console.log(`[git] Remove relPath=${relPath}`);
    return git.remove({ ...this._baseOpts, filepath: relPath });
  }

  async addRemote(url: string) {
    console.log(`[git] Add Remote url=${url}`);
    await git.addRemote({ ...this._baseOpts, remote: 'origin', url, force: true });
    const config = await this.getRemote('origin');

    if (config === null) {
      // Should never happen but it's here to make Flow happy
      throw new Error('Remote not found remote=origin');
    }

    return config;
  }

  async listRemotes(): Promise<GitRemoteConfig[]> {
    return git.listRemotes({ ...this._baseOpts });
  }

  async getAuthor() {
    const name = await git.getConfig({ ...this._baseOpts, path: 'user.name' });
    const email = await git.getConfig({ ...this._baseOpts, path: 'user.email' });
    return {
      name: name || '',
      email: email || '',
    } as GitAuthor;
  }

  async setAuthor(name: string, email: string) {
    await git.setConfig({ ...this._baseOpts, path: 'user.name', value: name });
    await git.setConfig({ ...this._baseOpts, path: 'user.email', value: email });
  }

  async getRemote(name: string): Promise<GitRemoteConfig | null> {
    const remotes = await this.listRemotes();
    return remotes.find(r => r.remote === name) || null;
  }

  async commit(message: string) {
    console.log(`[git] Commit "${message}"`);
    trackEvent('Git', 'Commit');
    return git.commit({ ...this._baseOpts, message });
  }

  /**
   * Check to see whether remote is different than local. This is here because
   * when pushing with isomorphic-git, if the HEAD of local is equal the HEAD
   * of remote, it will fail with a non-fast-forward message.
   *
   * @param gitCredentials
   * @returns {Promise<boolean>}
   */
  async canPush(gitCredentials?: GitCredentials | null) {
    const branch = await this.getBranch();
    const remote = await this.getRemote('origin');

    if (!remote) {
      throw new Error('Remote not configured');
    }

    const remoteInfo = await git.getRemoteInfo({
      ...this._baseOpts,
      ...gitCallbacks(gitCredentials),
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

  async push(gitCredentials?: GitCredentials | null, force = false) {
    console.log(`[git] Push remote=origin force=${force ? 'true' : 'false'}`);
    trackEvent('Git', 'Push');
    // eslint-disable-next-line no-unreachable
    const response: git.PushResult = await git.push({
      ...this._baseOpts,
      ...gitCallbacks(gitCredentials),
      remote: 'origin',
      force,
    });

    // @ts-expect-error -- TSCONVERSION git errors are not handled correctly
    if (response.errors?.length) {
      console.log('[git] Push rejected', response);
      // @ts-expect-error -- TSCONVERSION git errors are not handled correctly
      const errorsString = JSON.stringify(response.errors);
      throw new Error(
        `Push rejected with errors: ${errorsString}.\n\nGo to View > Toggle DevTools > Console for more information.`,
      );
    }
  }

  async pull(gitCredentials?: GitCredentials | null) {
    console.log('[git] Pull remote=origin', await this.getBranch());
    trackEvent('Git', 'Pull');
    return git.pull({
      ...this._baseOpts,
      ...gitCallbacks(gitCredentials),
      remote: 'origin',
      singleBranch: true,
    });
  }

  async merge(theirBranch: string) {
    const ours = await this.getBranch();
    console.log(`[git] Merge ${ours} <-- ${theirBranch}`);
    trackEvent('Git', 'Merge');
    return git.merge({
      ...this._baseOpts,
      ours,
      theirs: theirBranch,
    });
  }

  async fetch(
    singleBranch: boolean,
    depth: number,
    gitCredentials?: GitCredentials | null,
  ) {
    console.log('[git] Fetch remote=origin');
    return git.fetch({
      ...this._baseOpts,
      ...gitCallbacks(gitCredentials),
      singleBranch,
      remote: 'origin',
      depth,
      prune: true,
      pruneTags: true,
    });
  }

  async log(depth?: number) {
    try {
      return await git.log({ ...this._baseOpts, depth });
    } catch (error) {
      if (error.code === 'NotFoundError') {
        return [];
      }

      throw error;
    }
  }

  async branch(branch: string, checkout = false) {
    trackEvent('Git', 'Create Branch');
    // @ts-expect-error -- TSCONVERSION remote doesn't exist as an option
    await git.branch({ ...this._baseOpts, ref: branch, checkout, remote: 'origin' });
  }

  async deleteBranch(branch: string) {
    trackEvent('Git', 'Delete Branch');
    await git.deleteBranch({ ...this._baseOpts, ref: branch });
  }

  async checkout(branch: string) {
    console.log('[git] Checkout', {
      branch,
    });
    const branches = await this.listBranches();

    if (branches.includes(branch)) {
      trackEvent('Git', 'Checkout Branch');
      await git.checkout({ ...this._baseOpts, ref: branch, remote: 'origin' });
    } else {
      await this.branch(branch, true);
    }
  }

  async undoPendingChanges(fileFilter?: String[]) {
    console.log('[git] Undo pending changes');
    await git.checkout({
      ...this._baseOpts,
      ref: await this.getBranch(),
      remote: 'origin',
      force: true,
      filepaths: fileFilter?.map(convertToPosixSep),
    });
  }

  async readObjFromTree(treeOid: string, objPath: string) {
    try {
      const obj = await git.readObject({
        ...this._baseOpts,
        oid: treeOid,
        filepath: convertToPosixSep(objPath),
        encoding: 'utf8',
      });
      return obj.object;
    } catch (err) {
      return null;
    }
  }

  async repoExists() {
    try {
      await git.getConfig({ ...this._baseOpts, path: '' });
    } catch (err) {
      return false;
    }

    return true;
  }

  getFs() {
    return this._baseOpts.fs;
  }

  static sortBranches(branches: string[]) {
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
