import * as git from 'isomorphic-git';

import type { GitRepository } from '../../models/git-repository';
import { GIT_CLONE_DIR, GIT_INTERNAL_DIR } from './git-vcs';
import { httpClient } from './http-client';
import { gitCallbacks } from './utils';

interface Options {
  fsClient: git.FsClient;
  gitRepository: Pick<GitRepository, 'credentials' | 'uri'>;
}

/**
 * Create a shallow clone into the provided FS plugin.
 * */
export const shallowClone = async ({ fsClient, gitRepository }: Options) => {
  await git.clone({
    ...gitCallbacks(gitRepository.credentials),
    fs: fsClient,
    http: httpClient,
    dir: GIT_CLONE_DIR,
    gitdir: GIT_INTERNAL_DIR,
    singleBranch: true,
    url: gitRepository.uri,
    depth: 1,
  });
};
