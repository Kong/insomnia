// @flow

import * as git from 'isomorphic-git';
import { GIT_CLONE_DIR, GIT_INTERNAL_DIR } from './git-vcs';
import type { GitRepository } from '../../models/git-repository';
import { gitCallbacks } from './utils';
import { httpClient } from './http-client';

type Options = {
  fsPlugin: Object,
  gitRepository: GitRepository,
};

/**
 * Create a shallow clone into the provided FS plugin.
 * */
export const shallowClone = async ({ fsPlugin, gitRepository }: Options) => {
  const cloneParams = {
    ...gitCallbacks(gitRepository.credentials),
    fs: fsPlugin,
    http: httpClient,
    dir: GIT_CLONE_DIR,
    gitdir: GIT_INTERNAL_DIR,
    singleBranch: true,
    url: gitRepository.uri,
    depth: 1,
  };

  await git.clone(cloneParams);
};
