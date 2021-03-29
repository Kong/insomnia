// @flow

import type { GitRepository } from '../../models/git-repository';
import type { Workspace } from '../../models/workspace';
import { showAlert, showError, showModal } from '../../ui/components/modals';
import GitRepositorySettingsModal from '../../ui/components/modals/git-repository-settings-modal';
import * as models from '../../models';
import {
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
} from './git-vcs';
import path from 'path';
import * as git from 'isomorphic-git';

type Options = {
  createFsPlugin: () => Object,
  gitRepository: GitRepository,
  workspace: Workspace,
};

export const connectOrUpdateGitRepository = ({
  createFsPlugin,
  gitRepository,
  workspace,
}: Options) => {
  showModal(GitRepositorySettingsModal, {
    gitRepository,
    onSubmitEdits: async patch => {
      if (gitRepository) {
        await models.gitRepository.update(gitRepository, patch);
      } else {
        patch.needsFullClone = true;
        const core = Math.random() + '';

        // Create in-memory filesystem to perform clone
        const plugins = git.cores.create(core);
        const fsPlugin = createFsPlugin();
        plugins.set('fs', fsPlugin);

        // Pull settings returned from dialog and shallow-clone the repo
        const { credentials, uri: url } = patch;
        try {
          await git.clone({
            core,
            dir: GIT_CLONE_DIR,
            gitdir: GIT_INTERNAL_DIR,
            singleBranch: true,
            url,
            ...credentials,
            depth: 1,
            noGitSuffix: true,
          });
        } catch (err) {
          showError({ title: 'Error Cloning Repository', message: err.message, error: err });
          return;
        }

        const f = fsPlugin.promises;

        const ensureDir = async (base: string, name: string): Promise<boolean> => {
          const rootDirs = await f.readdir(base);
          if (rootDirs.includes(name)) {
            return true;
          }

          return false;
        };

        if (
          (await ensureDir(GIT_CLONE_DIR, GIT_INSOMNIA_DIR_NAME)) &&
          (await ensureDir(GIT_INSOMNIA_DIR, models.workspace.type))
        ) {
          const workspaceBase = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
          const workspaces = await f.readdir(workspaceBase);

          // If connecting a repo to a document and a workspace already exists, throw an error
          if (workspaces.length) {
            showAlert({
              title: 'Setup Problem',
              message:
                'This repository already contains a workspace; create a fresh clone from the dashboard.',
            });
            return;
          }
        }
        const newRepo = await models.gitRepository.create(patch);
        const meta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
        await models.workspaceMeta.update(meta, { gitRepositoryId: newRepo._id });
      }
    },
  });
};
