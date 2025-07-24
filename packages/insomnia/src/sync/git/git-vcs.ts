import path from 'node:path';

import * as git from 'isomorphic-git';
import { parse, stringify } from 'yaml';

import type { MergeConflict } from '../types';
import { httpClient } from './http-client';
import { convertToPosixSep } from './path-sep';
import { getAuthorFromGitRepository, gitCallbacks } from './utils';

export interface GitAuthor {
  name: string;
  email: string;
}

export interface GitRemoteConfig {
  remote: string;
  url: string;
}

interface GitCredentialsBase {
  username: string;
  password: string;
}

interface GitCredentialsOAuth {
  /**
   * Supported OAuth formats.
   * This is needed by isomorphic-git to be able to push/pull using an oauth2 token.
   * https://isomorphic-git.org/docs/en/authentication.html
   */
  oauth2format?: 'github' | 'gitlab';
  username: string;
  token: string;
}

export type GitCredentials = GitCredentialsBase | GitCredentialsOAuth;

export const isGitCredentialsOAuth = (credentials: GitCredentials): credentials is GitCredentialsOAuth => {
  return 'oauth2format' in credentials;
};

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
  gitCredentials?: GitCredentials | null;
  uri?: string;
  repoId: string;
  ref?: string;
  // If enabled git-vcs will only diff files inside a .insomnia directory
  legacyDiff?: boolean;
}

interface InitFromCloneOptions {
  url: string;
  gitCredentials?: GitCredentials | null;
  directory: string;
  fs: git.FsClient;
  gitDirectory: string;
  ref?: string;
  repoId: string;
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
export const GIT_INTERNAL_DIR = path.join(GIT_CLONE_DIR, gitInternalDirName); // .git
export const GIT_INSOMNIA_DIR = path.join(GIT_CLONE_DIR, GIT_INSOMNIA_DIR_NAME); // .insomnia

function getInsomniaFileName(blob: void | Uint8Array | undefined): string {
  if (!blob) {
    return '';
  }

  try {
    const parsed = parse(Buffer.from(blob).toString('utf-8'));
    return parsed?.fileName || parsed?.name || '';
  } catch {
    // If the document couldn't be parsed as yaml return an empty string
    return '';
  }
}

interface BaseOpts {
  dir: string;
  gitdir?: string;
  fs: git.CallbackFsClient | git.PromiseFsClient;
  http: git.HttpClient;
  onMessage: (message: string) => void;
  onAuthFailure: git.AuthFailureCallback;
  onAuthSuccess: git.AuthSuccessCallback;
  onAuth: git.AuthCallback;
  uri: string;
  repoId: string;
  legacyDiff?: boolean;
  ref?: string;
}

export class GitVCS {
  // @ts-expect-error -- TSCONVERSION not initialized with required properties
  _baseOpts: BaseOpts = gitCallbacks();

  async init({ directory, fs, gitDirectory, gitCredentials, uri = '', repoId, legacyDiff = false, ref }: InitOptions) {
    this._baseOpts = {
      ...this._baseOpts,
      dir: directory,
      ...gitCallbacks(gitCredentials),
      gitdir: gitDirectory,
      fs,
      http: httpClient,
      uri,
      repoId,
      legacyDiff,
      ref,
    };

    if (await this.repoExists()) {
      console.log(`[git] Opened repo for ${gitDirectory}`);
    } else {
      console.log(`[git] Initialized repo in ${gitDirectory}`);
      let defaultBranch = 'main';

      try {
        const url = await this.getRemoteOriginURI();
        if (!url) {
          throw new Error('No remote origin URL');
        }
        const [mainRef] = await git.listServerRefs({
          ...this._baseOpts,
          url,
          prefix: 'HEAD',
          symrefs: true,
        });

        defaultBranch = mainRef?.target?.replace('refs/heads/', '') || 'main';
      } catch {
        // Ignore error
      }

      await git.init({ ...this._baseOpts, defaultBranch });
    }
  }

  async getRemoteOriginURI() {
    try {
      const remoteOriginURI = await git.getConfig({
        ...this._baseOpts,
        path: 'remote.origin.url',
      });

      return remoteOriginURI;
    } catch {
      // Ignore error
      return this._baseOpts.uri || '';
    }
  }

  async initFromClone({ repoId, url, gitCredentials, directory, fs, gitDirectory, ref }: InitFromCloneOptions) {
    this._baseOpts = {
      ...this._baseOpts,
      ...gitCallbacks(gitCredentials),
      dir: directory,
      gitdir: gitDirectory,
      fs,
      http: httpClient,
      repoId,
    };

    const initRef = ref || this._baseOpts.ref;

    try {
      await git.clone({
        ...this._baseOpts,
        url,
        ...(initRef ? { ref: initRef } : {}),
      });
    } catch (err) {
      // If we there is a checkout conflict we only want to clone the repo
      if (err instanceof git.Errors.CheckoutConflictError) {
        await git.clone({
          ...this._baseOpts,
          url,
          ...(initRef ? { ref: initRef } : {}),
          noCheckout: true,
        });
      }
    }

    console.log(`[git] Cloned repo to ${gitDirectory} from ${url}`);
  }

  isInitializedForRepo(id: string) {
    return this._baseOpts.repoId === id;
  }

  async getCurrentBranch() {
    const branch = await git.currentBranch({ ...this._baseOpts });

    if (typeof branch !== 'string') {
      throw new Error('No active branch');
    }

    return branch;
  }

  async listBranches() {
    const branch = await this.getCurrentBranch();
    const branches = await git.listBranches({ ...this._baseOpts });

    // For some reason, master isn't in branches on fresh repo (no commits)
    if (!branches.includes(branch)) {
      branches.push(branch);
    }

    console.log(`[git] Local branches: ${branches.join(', ')} (current: ${branch})`);

    return GitVCS.sortBranches(branches);
  }

  async listRemoteBranches() {
    const branches = await git.listBranches({
      ...this._baseOpts,
      remote: 'origin',
    });
    // Don't care about returning remote HEAD
    return GitVCS.sortBranches(branches.filter(b => b !== 'HEAD'));
  }

  async fetchRemoteBranches() {
    const uri = await this.getRemoteOriginURI();
    try {
      const branches = await git.listServerRefs({
        ...this._baseOpts,
        prefix: 'refs/heads/',
        url: uri,
      });
      console.log({ branches });
      // Don't care about returning remote HEAD
      return GitVCS.sortBranches(branches.filter(b => b.ref !== 'HEAD').map(b => b.ref.replace('refs/heads/', '')));
    } catch (e) {
      console.log(`[git] Failed to list remote branches for ${uri}`, e);
      return [];
    }
  }

  async fileStatus(file: string) {
    const baseOpts = this._baseOpts;
    // Adopted from statusMatrix of isomorphic-git https://github.com/isomorphic-git/isomorphic-git/blob/main/src/api/statusMatrix.js#L157
    const [blobs]: [[string, string, string, string]] = await git.walk({
      ...baseOpts,
      trees: [git.TREE({ ref: 'HEAD' }), git.WORKDIR(), git.STAGE()],
      map: async function map(filepath, [head, workdir, stage]) {
        // Late filter against file names
        if (filepath !== file) {
          return;
        }

        const [headType, workdirType, stageType] = await Promise.all([
          head && head.type(),
          workdir && workdir.type(),
          stage && stage.type(),
        ]);

        const isBlob = [headType, workdirType, stageType].includes('blob');

        // For now, bail on directories unless the file is also a blob in another tree
        if ((headType === 'tree' || headType === 'special') && !isBlob) {
          return;
        }
        if (headType === 'commit') {
          return null;
        }

        if ((workdirType === 'tree' || workdirType === 'special') && !isBlob) {
          return;
        }

        if (stageType === 'commit') {
          return null;
        }
        if ((stageType === 'tree' || stageType === 'special') && !isBlob) {
          return;
        }

        // Figure out the oids for files, using the staged oid for the working dir oid if the stats match.
        const headOid = headType === 'blob' ? await head?.oid() : undefined;
        const stageOid = stageType === 'blob' ? await stage?.oid() : undefined;
        let workdirOid;
        if (headType !== 'blob' && workdirType === 'blob' && stageType !== 'blob') {
          workdirOid = '42';
        } else if (workdirType === 'blob') {
          workdirOid = await workdir?.oid();
        }

        let headBlob = await head?.content();
        let workdirBlob = await workdir?.content();
        let stageBlob = await stage?.content();

        if (!stageBlob && stageOid) {
          try {
            const { blob } = await git.readBlob({
              ...baseOpts,

              oid: stageOid,
            });

            stageBlob = blob;
          } catch (e) {
            console.log('[git] Failed to read blob', e);
          }
        }

        if (!headBlob && headOid) {
          try {
            const { blob } = await git.readBlob({
              ...baseOpts,

              oid: headOid,
            });

            headBlob = blob;
          } catch (e) {
            console.log('[git] Failed to read blob', e);
          }
        }

        if (!workdirBlob && workdirOid) {
          try {
            const { blob } = await git.readBlob({
              ...baseOpts,

              oid: workdirOid,
            });

            workdirBlob = blob;
          } catch (e) {
            console.log('[git] Failed to read blob', e);
          }
        }

        const blobsAsStrings = [headBlob, workdirBlob, stageBlob].map(blob => {
          if (!blob) {
            return null;
          }

          try {
            return Buffer.from(blob).toString('utf-8');
          } catch {
            return null;
          }
        });

        return [filepath, ...blobsAsStrings];
      },
    });

    const diff = {
      head: blobs[1],
      workdir: blobs[2],
      stage: blobs[3],
    };

    return diff;
  }

  async statusWithContent() {
    const baseOpts = this._baseOpts;

    // Adopted from statusMatrix of isomorphic-git https://github.com/isomorphic-git/isomorphic-git/blob/main/src/api/statusMatrix.js#L157
    const status: {
      filepath: string;
      head: { name: string; status: git.HeadStatus };
      workdir: { name: string; status: git.WorkdirStatus };
      stage: { name: string; status: git.StageStatus };
    }[] = await git.walk({
      ...baseOpts,
      trees: [
        // What the latest commit on the current branch looks like
        git.TREE({ ref: 'HEAD' }),
        // What the working directory looks like
        git.WORKDIR(),
        // What the index (staging area) looks like
        git.STAGE(),
      ],
      map: async function map(filepath, [head, workdir, stage]) {
        if (baseOpts.legacyDiff) {
          const isInsomniaFile =
            filepath.startsWith(GIT_INSOMNIA_DIR_NAME) || filepath.startsWith('insomnia.') || filepath === '.';
          if (!isInsomniaFile) {
            return null;
          }
        } else {
          // If the path is a file with an extension different than yaml we don't want to check it
          if (path.extname(filepath) && path.extname(filepath) !== '.yaml') {
            return null;
          }
        }

        if (
          await git.isIgnored({
            ...baseOpts,
            filepath,
          })
        ) {
          return null;
        }
        const [headType, workdirType, stageType] = await Promise.all([
          head && head.type(),
          workdir && workdir.type(),
          stage && stage.type(),
        ]);

        const isBlob = [headType, workdirType, stageType].includes('blob');

        // For now, bail on directories unless the file is also a blob in another tree
        if ((headType === 'tree' || headType === 'special') && !isBlob) {
          return;
        }
        if (headType === 'commit') {
          return null;
        }

        if ((workdirType === 'tree' || workdirType === 'special') && !isBlob) {
          return;
        }

        if (stageType === 'commit') {
          return null;
        }
        if ((stageType === 'tree' || stageType === 'special') && !isBlob) {
          return;
        }

        // Figure out the oids for files, using the staged oid for the working dir oid if the stats match.
        const headOid = headType === 'blob' ? await head?.oid() : undefined;
        const stageOid = stageType === 'blob' ? await stage?.oid() : undefined;
        let workdirOid;
        if (headType !== 'blob' && workdirType === 'blob' && stageType !== 'blob') {
          // We don't actually NEED the sha. Any sha will do
          // TODO: update this logic to handle N trees instead of just 3.
          workdirOid = '42';
        } else if (workdirType === 'blob') {
          workdirOid = await workdir?.oid();
        }

        // Adopted from isomorphic-git statusMatrix.
        // This is needed to return the same status code numbers as isomorphic-git
        // In isomorphic-git it can be found in these types: git.HeadStatus, git.WorkdirStatus, and git.StageStatus
        const entry = [undefined, headOid, workdirOid, stageOid];
        const result = entry.map(value => entry.indexOf(value));
        result.shift(); // remove leading undefined entry

        let headName = filepath;
        let workdirName = filepath;
        let stageName = filepath;

        if (baseOpts.legacyDiff) {
          const headBlob = await head?.content();
          const workdirBlob = await workdir?.content();
          let stageBlob = await stage?.content();

          if (!stageBlob && stageOid) {
            try {
              const { blob } = await git.readBlob({
                ...baseOpts,

                oid: stageOid,
              });

              stageBlob = blob;
            } catch (e) {
              console.log('[git] Failed to read blob', e);
            }
          }

          headName = getInsomniaFileName(headBlob);
          workdirName = getInsomniaFileName(workdirBlob);
          stageName = getInsomniaFileName(stageBlob);
        }

        return {
          filepath,
          head: {
            name: headName,
            status: result[0],
          },
          workdir: {
            name: workdirName,
            status: result[1],
          },
          stage: {
            name: stageName,
            status: result[2],
          },
        };
      },
    });

    return status;
  }

  async status(): Promise<{
    staged: { path: string; status: [git.HeadStatus, git.WorkdirStatus, git.StageStatus]; name: string }[];
    unstaged: { path: string; status: [git.HeadStatus, git.WorkdirStatus, git.StageStatus]; name: string }[];
  }> {
    const status = await this.statusWithContent();

    const unstagedChanges = status.filter(({ workdir, stage }) => stage.status !== workdir.status);
    const stagedChanges = status.filter(({ head, stage }) => stage.status !== head.status);

    return {
      staged: stagedChanges.map(({ filepath, head, workdir, stage }) => ({
        path: filepath,
        status: [head.status, workdir.status, stage.status],
        name: stage.name || head.name || workdir.name || '',
      })),
      unstaged: unstagedChanges.map(({ filepath, head, workdir, stage }) => ({
        path: filepath,
        status: [head.status, workdir.status, stage.status],
        name: workdir.name || stage.name || head.name || '',
      })),
    };
  }

  async addRemote(url: string) {
    console.log(`[git] Add Remote url=${url}`);
    await git.addRemote({
      ...this._baseOpts,
      remote: 'origin',
      url,
      force: true,
    });
    const config = await this.getRemote('origin');

    if (config === null) {
      throw new Error('Remote not found remote=origin');
    }

    return config;
  }

  async listRemotes(): Promise<GitRemoteConfig[]> {
    return git.listRemotes({ ...this._baseOpts });
  }

  async setAuthor(author?: GitAuthor) {
    let name = '';
    let email = '';

    if (author) {
      name = author.name;
      email = author.email;
    } else {
      const author = await getAuthorFromGitRepository(this._baseOpts.repoId);
      name = author.name;
      email = author.email;
    }

    await git.setConfig({ ...this._baseOpts, path: 'user.name', value: name });
    await git.setConfig({
      ...this._baseOpts,
      path: 'user.email',
      value: email,
    });
  }

  async getRemote(name: string): Promise<GitRemoteConfig | null> {
    const remotes = await this.listRemotes();
    return remotes.find(r => r.remote === name) || null;
  }

  async commit(message: string) {
    console.log(`[git] Commit "${message}"`);
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
  async canPush(gitCredentials?: GitCredentials | null): Promise<boolean> {
    const branch = await this.getCurrentBranch();
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
    const logs = (await this.log({ depth: 1 })) || [];
    const localHead = logs[0]?.oid;
    const remoteRefs = remoteInfo.refs || {};
    const remoteHeads = remoteRefs.heads || {};
    const remoteHead = remoteHeads[branch];

    // If there is no local or remote head it means that the branch is new
    if (!localHead && !remoteHead) {
      return true;
    }

    if (localHead === remoteHead) {
      return false;
    }

    return true;
  }

  async push(gitCredentials?: GitCredentials | null, force = false) {
    console.log(`[git] Push remote=origin force=${force ? 'true' : 'false'}`);

    const response = await git.push({
      ...this._baseOpts,
      ...gitCallbacks(gitCredentials),
      remote: 'origin',
      force,
    });

    if (response.error) {
      console.log('[git] Push rejected', response);
      throw new Error(
        `Push rejected with errors: ${response.error}.\n\nGo to View > Toggle DevTools > Console for more information.`,
      );
    }

    if ('errors' in response && response.errors && Array.isArray(response.errors)) {
      console.log('[git] Push failed with errors', response.errors);
      const errorsString = JSON.stringify(response.errors);
      throw new Error(
        `Push rejected with errors: ${errorsString}.\n\nGo to View > Toggle DevTools > Console for more information.`,
      );
    }

    // NOTE: Response can be ok and have errors so we check this in the end to make sure we throw an error if there are any.
    if (response.ok) {
      console.log('[git] Push successful');
      return;
    }

    throw new Error('Push failed with unknown error. Please try again.');
  }

  async _hasUncommittedChanges() {
    const changes = await this.status();
    return changes.staged.length > 0 || changes.unstaged.length > 0;
  }

  async pull(gitCredentials?: GitCredentials | null) {
    const hasUncommittedChanges = await this._hasUncommittedChanges();
    if (hasUncommittedChanges) {
      throw new Error('Cannot pull with uncommitted changes, please commit local changes first.');
    }
    console.log('[git] Pull remote=origin', await this.getCurrentBranch());
    return git
      .pull({
        ...this._baseOpts,
        ...gitCallbacks(gitCredentials),
        remote: 'origin',
        singleBranch: true,
      })
      .catch(async err => {
        if (err instanceof git.Errors.MergeConflictError) {
          const oursBranch = await this.getCurrentBranch();
          const theirsBranch = `origin/${oursBranch}`;

          return await this._collectMergeConflicts(err, oursBranch, theirsBranch);
        }
        throw err;
      });
  }

  // Collect merge conflict details from isomorphic-git git.Errors.MergeConflictError and throw a MergeConflictError which will be used to display the conflicts in the SyncMergeModal
  async _collectMergeConflicts(
    mergeConflictError: InstanceType<typeof git.Errors.MergeConflictError>,
    oursBranch: string,
    theirsBranch: string,
  ) {
    const { filepaths, bothModified, deleteByUs, deleteByTheirs } = mergeConflictError.data;
    if (filepaths.length) {
      const mergeConflicts: MergeConflict[] = [];
      const conflictPathsObj = {
        bothModified,
        deleteByUs,
        deleteByTheirs,
      };
      const conflictTypeList: (keyof typeof conflictPathsObj)[] = ['bothModified', 'deleteByUs', 'deleteByTheirs'];

      const oursHeadCommitOid = await git.resolveRef({
        ...this._baseOpts,
        ref: oursBranch,
      });

      const theirsHeadCommitOid = await git.resolveRef({
        ...this._baseOpts,
        ref: theirsBranch,
      });

      const _baseOpts = this._baseOpts;

      function readBlob(filepath: string, oid: string) {
        return git
          .readBlob({
            ..._baseOpts,
            oid,
            filepath,
          })
          .then(({ blob, oid: blobId }) => ({
            blobContent: parse(Buffer.from(blob).toString('utf8')),
            blobId,
          }));
      }

      function readOursBlob(filepath: string) {
        return readBlob(filepath, oursHeadCommitOid);
      }

      function readTheirsBlob(filepath: string) {
        return readBlob(filepath, theirsHeadCommitOid);
      }

      for (const conflictType of conflictTypeList) {
        const conflictPaths = conflictPathsObj[conflictType];
        const message = {
          bothModified: 'both modified',
          deleteByUs: 'you deleted and they modified',
          deleteByTheirs: 'they deleted and you modified',
        }[conflictType];
        for (const conflictPath of conflictPaths) {
          let mineBlobContent = null;
          let mineBlobId = null;

          let theirsBlobContent = null;
          let theirsBlobId = null;

          if (conflictType !== 'deleteByUs') {
            const { blobContent, blobId } = await readOursBlob(conflictPath);
            mineBlobContent = blobContent;
            mineBlobId = blobId;
          }

          if (conflictType !== 'deleteByTheirs') {
            const { blobContent, blobId } = await readTheirsBlob(conflictPath);
            theirsBlobContent = blobContent;
            theirsBlobId = blobId;
          }
          const name = mineBlobContent?.name || theirsBlobContent?.name || '';

          mergeConflicts.push({
            key: conflictPath,
            name,
            message,
            mineBlob: mineBlobId,
            theirsBlob: theirsBlobId,
            choose: mineBlobId || theirsBlobId,
            mineBlobContent,
            theirsBlobContent,
          });
        }
      }

      throw new MergeConflictError('Need to solve merge conflicts first', {
        conflicts: mergeConflicts,
        labels: {
          ours: `${oursBranch} ${oursHeadCommitOid}`,
          theirs: `${theirsBranch} ${theirsHeadCommitOid}`,
        },
        commitMessage: `Merge branch '${theirsBranch}' into ${oursBranch}`,
        commitParent: [oursHeadCommitOid, theirsHeadCommitOid],
      });
    } else {
      throw new Error('Merge conflict filepaths is of length 0');
    }
  }

  // create a commit after resolving merge conflicts
  async continueMerge({
    handledMergeConflicts,
    commitMessage,
    commitParent,
  }: {
    gitCredentials?: GitCredentials | null;
    handledMergeConflicts: MergeConflict[];
    commitMessage: string;
    commitParent: string[];
  }) {
    console.log('[git] continue to merge after resolving merge conflicts', await this.getCurrentBranch());

    // Because wo don't need to do anything with the conflicts that the user has chosen to keep 'ours'
    // Here we just filter in conflicts that user has chosen to keep 'theirs'
    handledMergeConflicts = handledMergeConflicts.filter(conflict => conflict.choose !== conflict.mineBlob);

    for (const conflict of handledMergeConflicts) {
      assertIsPromiseFsClient(this._baseOpts.fs);
      if (conflict.theirsBlobContent) {
        await this._baseOpts.fs.promises.writeFile(conflict.key, stringify(conflict.theirsBlobContent));
        await git.add({ ...this._baseOpts, filepath: conflict.key });
      } else {
        await this._baseOpts.fs.promises.unlink(conflict.key);
        await git.remove({ ...this._baseOpts, filepath: conflict.key });
      }
    }

    // Add other non-conflicted files to the stage area
    await git.add({ ...this._baseOpts, filepath: '.' });

    await git.commit({
      ...this._baseOpts,
      message: commitMessage,
      parent: commitParent,
    });
  }

  async merge({
    theirsBranch,
    allowUncommittedChangesBeforeMerge = false,
  }: {
    theirsBranch: string;
    allowUncommittedChangesBeforeMerge?: boolean;
  }) {
    if (!allowUncommittedChangesBeforeMerge) {
      const hasUncommittedChanges = await this._hasUncommittedChanges();
      if (hasUncommittedChanges) {
        throw new Error('There are uncommitted changes on current branch. Please commit them before merging.');
      }
    }
    const oursBranch = await this.getCurrentBranch();
    console.log(`[git] Merge ${oursBranch} <-- ${theirsBranch}`);
    return git
      .merge({
        ...this._baseOpts,
        ours: oursBranch,
        theirs: theirsBranch,
        abortOnConflict: false,
      })
      .catch(async err => {
        if (err instanceof git.Errors.MergeConflictError) {
          return await this._collectMergeConflicts(err, oursBranch, theirsBranch);
        }

        if (err instanceof git.Errors.MergeNotSupportedError) {
          const errorMessage = 'Merges with additions are not supported yet.';

          throw new Error(errorMessage);
        }

        throw err;
      });
  }

  async fetch({
    singleBranch,
    depth,
    credentials,
    relative = false,
  }: {
    singleBranch: boolean;
    depth?: number;
    credentials?: GitCredentials | null;
    relative?: boolean;
  }) {
    console.log('[git] Fetch remote=origin');
    return git.fetch({
      ...this._baseOpts,
      ...gitCallbacks(credentials),
      singleBranch,
      remote: 'origin',
      relative,
      depth,
      prune: true,
      pruneTags: true,
    });
  }

  async log(input: { depth?: number } = {}) {
    const { depth = 35 } = input;
    try {
      const remoteOriginURI = await this.getRemoteOriginURI();
      if (remoteOriginURI) {
        await git.fetch({
          ...this._baseOpts,
          remote: 'origin',
          depth,
          singleBranch: true,
          tags: false,
        });
      }

      return await git.log({ ...this._baseOpts, depth });
    } catch (error: unknown) {
      if (error instanceof git.Errors.NotFoundError) {
        return [];
      }

      throw error;
    }
  }

  async branch(branch: string, checkout = false) {
    console.log('[git] Branch', {
      branch,
      checkout,
    });

    await git.branch({
      ...this._baseOpts,
      ref: branch,
      checkout,
      // @ts-expect-error -- TSCONVERSION remote doesn't exist as an option
      remote: 'origin',
    });
  }

  async deleteBranch(branch: string) {
    await git.deleteBranch({ ...this._baseOpts, ref: branch });
  }

  async checkout(branch: string) {
    console.log('[git] Checkout', {
      branch,
    });
    const localBranches = await this.listBranches();
    const syncedBranches = await this.listRemoteBranches();
    const remoteBranches = await this.fetchRemoteBranches();
    const branches = [...localBranches, ...syncedBranches, ...remoteBranches];
    console.log('[git] Checkout branches', { branches, branch });

    if (branches.includes(branch)) {
      try {
        if (!syncedBranches.includes(branch)) {
          console.log('[git] Fetching branch', branch);
          // Try to fetch the branch from the remote if it doesn't exist locally;
          await git.fetch({
            ...this._baseOpts,
            remote: 'origin',
            depth: 1,
            ref: branch,
            singleBranch: true,
            tags: false,
          });
        }
      } catch (e) {
        console.log('[git] Fetch failed', e);
      }

      await git.checkout({
        ...this._baseOpts,
        ref: branch,

        remote: 'origin',
      });
      const branches = await this.listBranches();
      console.log('[git] Checkout branches', { branches });
    } else {
      await this.branch(branch, true);
    }
  }

  async repoExists() {
    try {
      await git.getConfig({ ...this._baseOpts, path: '' });
    } catch {
      return false;
    }

    return true;
  }

  async stageChanges(changes: { path: string; status: [git.HeadStatus, git.WorkdirStatus, git.StageStatus] }[]) {
    for (const change of changes) {
      console.log(`[git] Stage ${change.path} | ${change.status}`);
      if (change.status[1] === 0) {
        await git.remove({ ...this._baseOpts, filepath: convertToPosixSep(path.join('.', change.path)) });
      } else {
        await git.add({ ...this._baseOpts, filepath: convertToPosixSep(path.join('.', change.path)) });
      }
    }
  }

  async unstageChanges(changes: { path: string; status: [git.HeadStatus, git.WorkdirStatus, git.StageStatus] }[]) {
    for (const change of changes) {
      await git.resetIndex({ ...this._baseOpts, filepath: change.path });
    }
  }

  async discardChanges(changes: { path: string; status: [git.HeadStatus, git.WorkdirStatus, git.StageStatus] }[]) {
    for (const change of changes) {
      // If the file didn't exist in HEAD, we need to remove it
      if (change.status[0] === 0) {
        await git.remove({ ...this._baseOpts, filepath: change.path });
        // @ts-expect-error -- TSCONVERSION
        await this._baseOpts.fs.promises.unlink(change.path);
      } else {
        await git.checkout({
          ...this._baseOpts,
          force: true,
          ref: await this.getCurrentBranch(),
          filepaths: [convertToPosixSep(change.path)],
        });
      }
    }
  }

  static sortBranches(branches: string[]) {
    const newBranches = [...branches];
    newBranches.sort((a: string, b: string) => {
      if (a === 'master') {
        return -1;
      } else if (b === 'master') {
        return 1;
      }
      return b > a ? -1 : 1;
    });
    return newBranches;
  }
}
export class MergeConflictError extends Error {
  constructor(
    msg: string,
    data: {
      conflicts: MergeConflict[];
      labels: {
        ours: string;
        theirs: string;
      };
      commitMessage: string;
      commitParent: string[];
    },
  ) {
    super(msg);
    this.data = data;
  }
  data;
  name = 'MergeConflictError';
}

function assertIsPromiseFsClient(fs: git.FsClient): asserts fs is git.PromiseFsClient {
  if (!('promises' in fs)) {
    throw new Error('Expected fs to be of PromiseFsClient');
  }
}

export async function fetchRemoteBranches({ uri, credentials }: { uri: string; credentials?: GitCredentials | null }) {
  const [mainRef] = await git.listServerRefs({
    ...gitCallbacks(credentials),
    http: httpClient,
    url: uri,
    prefix: 'HEAD',
    symrefs: true,
  });

  const remoteRefs = await git.listServerRefs({
    ...gitCallbacks(credentials),
    http: httpClient,
    url: uri,
    prefix: 'refs/heads/',
    symrefs: true,
  });

  const defaultBranch = mainRef?.target?.replace('refs/heads/', '') || 'main';

  const remoteBranches = remoteRefs
    .filter(b => b.ref !== 'HEAD')
    .map(b => b.ref.replace('refs/heads/', ''))
    .sort((a, b) => {
      if (a === defaultBranch) return -1;
      if (b === defaultBranch) return 1;
      return a.localeCompare(b);
    });

  return remoteBranches;
}

export default new GitVCS();
