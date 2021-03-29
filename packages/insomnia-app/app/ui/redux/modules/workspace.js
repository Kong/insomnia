// @flow

import type { Workspace, WorkspaceScope } from '../../../models/workspace';
import * as models from '../../../models';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../../common/constants';
import { trackEvent, trackSegmentEvent } from '../../../common/analytics';
import { isDesign } from '../../../models/helpers/is-model';
import { showAlert, showError, showModal, showPrompt } from '../../components/modals';
import { setActiveActivity, setActiveWorkspace } from './global';
import GitRepositorySettingsModal from '../../components/modals/git-repository-settings-modal';
import * as git from 'isomorphic-git';
import {
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
} from '../../../sync/git/git-vcs';
import { strings } from '../../../common/strings';
import path from 'path';
import YAML from 'yaml';
import * as React from 'react';
import * as db from '../../../common/database';
import { WorkspaceScopeKeys } from '../../../models/workspace';
import type { GitRepository } from '../../../models/git-repository';

type OnWorkspaceCreateCallback = Workspace => Promise<void> | void;

const actuallyCreate = (patch: $Shape<Workspace>, onCreate?: OnWorkspaceCreateCallback) => {
  return async dispatch => {
    const workspace = await models.workspace.create(patch);

    if (onCreate) {
      await onCreate(workspace);
    }

    trackEvent('Workspace', 'Create');
    dispatch(setActiveWorkspace(workspace._id));
    dispatch(setActiveActivity(isDesign(workspace) ? ACTIVITY_SPEC : ACTIVITY_DEBUG));
  };
};

export type CreateWorkspaceCallback = ({
  scope: WorkspaceScope,
  onCreate: OnWorkspaceCreateCallback,
}) => void;

export const createWorkspace: CreateWorkspaceCallback = ({ scope, onCreate }) => {
  return dispatch => {
    const design = isDesign({ scope });

    const title = design ? 'Design Document' : 'Request Collection';
    const defaultValue = design ? 'my-spec.yaml' : 'My Collection';
    const segmentEvent = design ? 'Document Created' : 'Collection Created';

    showPrompt({
      title: `Create New ${title}`,
      submitName: 'Create',
      placeholder: defaultValue,
      defaultValue,
      onComplete: async name => {
        await dispatch(actuallyCreate({ name, scope }, onCreate));
        trackSegmentEvent(segmentEvent);
      },
    });
  };
};

const createWorkspaceWithGitRepo = (gitRepo: GitRepository) => {
  return dispatch =>
    dispatch(
      createWorkspace({
        scope: WorkspaceScopeKeys.design,
        onCreate: async wrk => {
          await createGitRepoSettings(wrk._id, gitRepo);
        },
      }),
    );
};

const createGitRepoSettings = async (workspaceId: string, gitRepo: GitRepository) => {
  const newRepo = await models.gitRepository.create(gitRepo);
  const meta = await models.workspaceMeta.getOrCreateByParentId(workspaceId);
  await models.workspaceMeta.update(meta, { gitRepositoryId: newRepo._id });
};

const cloneProblem = (message: React.Node) => {
  showAlert({
    title: 'Clone Problem',
    message,
  });
};

const noDocumentFound = (gitRepo: GitRepository) => {
  return dispatch => {
    showAlert({
      title: `No ${strings.document.toLowerCase()} found`,
      okLabel: 'Yes',
      addCancel: true,
      message: `No ${strings.document.toLowerCase()} found in the repository for import. Would you like to create a new one?`,
      onConfirm: async () => await dispatch(createWorkspaceWithGitRepo(gitRepo)),
    });
  };
};

export type GitCloneWorkspaceCallback = ({ createFsPlugin: () => Object }) => void;

export const gitCloneWorkspace: GitCloneWorkspaceCallback = ({ createFsPlugin }) => {
  return dispatch => {
    // This is a huge flow and we don't really have anywhere to put something like this. I guess
    // it's fine here for now (?)
    showModal(GitRepositorySettingsModal, {
      gitRepository: null,
      onSubmitEdits: async repoSettingsPatch => {
        repoSettingsPatch.needsFullClone = true;

        trackEvent('Git', 'Clone');

        const core = Math.random() + '';

        // Create in-memory filesystem to perform clone
        const plugins = git.cores.create(core);
        const fsPlugin = createFsPlugin();
        plugins.set('fs', fsPlugin);

        // Pull settings returned from dialog and shallow-clone the repo
        const { credentials, uri: url } = repoSettingsPatch;
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
          return false;
        }

        const f = fsPlugin.promises;
        const ensureDir = async (base: string, name: string): Promise<boolean> => {
          const rootDirs = await f.readdir(base);
          if (rootDirs.includes(name)) {
            return true;
          }

          return false;
        };

        if (!(await ensureDir(GIT_CLONE_DIR, GIT_INSOMNIA_DIR_NAME))) {
          dispatch(noDocumentFound(repoSettingsPatch));
          return;
        }

        if (!(await ensureDir(GIT_INSOMNIA_DIR, models.workspace.type))) {
          dispatch(noDocumentFound(repoSettingsPatch));
          return;
        }

        const workspaceBase = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
        const workspaces = await f.readdir(workspaceBase);

        if (workspaces.length > 1) {
          cloneProblem('Multiple workspaces found in repository; expected one.');
          return;
        }

        if (workspaces.length === 0) {
          dispatch(noDocumentFound(repoSettingsPatch));
          return;
        }

        const workspacePath = path.join(workspaceBase, workspaces[0]);
        const workspaceJson = await f.readFile(workspacePath);
        const workspace = YAML.parse(workspaceJson.toString());

        // Check if the workspace already exists
        const existingWorkspace = await models.workspace.getById(workspace._id);

        if (existingWorkspace) {
          cloneProblem(
            <>
              Workspace <strong>{existingWorkspace.name}</strong> already exists. Please delete it
              before cloning.
            </>,
          );
          return;
        }

        // Prompt user to confirm importing the workspace
        showAlert({
          title: 'Project Found',
          okLabel: 'Import',
          message: (
            <>
              Workspace <strong>{workspace.name}</strong> found in repository. Would you like to
              import it?
            </>
          ),

          // Import all docs to the DB
          onConfirm: async () => {
            // Stop the DB from pushing updates to the UI temporarily
            const bufferId = await db.bufferChanges();

            // Loop over all model folders in root
            for (const modelType of await f.readdir(GIT_INSOMNIA_DIR)) {
              const modelDir = path.join(GIT_INSOMNIA_DIR, modelType);

              // Loop over all documents in model folder and save them
              for (const docFileName of await f.readdir(modelDir)) {
                const docPath = path.join(modelDir, docFileName);
                const docYaml = await f.readFile(docPath);
                const doc = YAML.parse(docYaml.toString());
                await db.upsert(doc);
              }
            }

            // Store GitRepository settings and set it as active
            await createGitRepoSettings(workspace._id, repoSettingsPatch);

            // Activate the workspace after importing everything
            dispatch(setActiveWorkspace(workspace._id));

            // Flush DB changes
            await db.flushChanges(bufferId);
          },
        });
      },
    });
  };
};
