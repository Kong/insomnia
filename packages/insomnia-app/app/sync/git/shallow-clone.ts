import * as git from 'isomorphic-git';
import { GIT_CLONE_DIR, GIT_INTERNAL_DIR } from './git-vcs';
import type { GitRepository } from '../../models/git-repository';
import { gitCallbacks } from './utils';
import { httpClient } from './http-client';
type Options = {
  fsClient: Record<string, any>;
  gitRepository: GitRepository;
};

/**
 * Create a shallow clone into the provided FS plugin.
 * */
export const shallowClone = async ({ fsClient, gitRepository }: Options) => {
  const cloneParams = {
    ...gitCallbacks(gitRepository.credentials),
    fs: fsClient,
    http: httpClient,
    dir: GIT_CLONE_DIR,
    gitdir: GIT_INTERNAL_DIR,
    singleBranch: true,
    url: gitRepository.uri,
    depth: 1,
  };
  await git.clone(cloneParams);
};
