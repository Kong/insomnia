// @flow

import * as git from 'isomorphic-git';
import { GIT_CLONE_DIR, GIT_INTERNAL_DIR } from './git-vcs';
import type { GitRepository } from '../../models/git-repository';

type Options = {
  fsPlugin: Object,
  gitRepository: GitRepository,
};

/**
 * Create a shallow clone into the provided FS plugin.
 * */
export const shallowClone = async ({ fsPlugin, gitRepository: { credentials, uri } }: Options) => {
  const core = Math.random() + '';
  const plugins = git.cores.create(core);
  plugins.set('fs', fsPlugin);

  await git.clone({
    core,
    dir: GIT_CLONE_DIR,
    gitdir: GIT_INTERNAL_DIR,
    singleBranch: true,
    url: uri,
    ...credentials,
    depth: 1,
    noGitSuffix: true,
  });
};
