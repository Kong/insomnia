import { createBuilder } from '@develohpanda/fluent-builder';
import { PromiseFsClient } from 'isomorphic-git';
import path from 'path';
import React, { Fragment } from 'react';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { mocked } from 'ts-jest/utils';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { SegmentEvent, trackEvent, trackSegmentEvent } from '../../../../common/analytics';
import { ACTIVITY_SPEC } from '../../../../common/constants';
import * as models from '../../../../models';
import { gitRepositorySchema } from '../../../../models/__schemas__/model-schemas';
import { DEFAULT_PROJECT_ID } from '../../../../models/project';
import { Workspace, WorkspaceScopeKeys } from '../../../../models/workspace';
import { GIT_INSOMNIA_DIR } from '../../../../sync/git/git-vcs';
import { MemClient } from '../../../../sync/git/mem-client';
import { shallowClone as _shallowClone } from '../../../../sync/git/shallow-clone';
import {
  getAndClearShowAlertMockArgs,
  getAndClearShowErrorMockArgs,
  getAndClearShowModalMockArgs,
  getAndClearShowPromptMockArgs,
} from '../../../../test-utils';
import { cloneGitRepository, setupGitRepository } from '../git';
import { LOAD_START, LOAD_STOP, SET_ACTIVE_ACTIVITY, SET_ACTIVE_PROJECT, SET_ACTIVE_WORKSPACE } from '../global';

jest.mock('../../../components/modals');
jest.mock('../../../../sync/git/shallow-clone');
jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const shallowClone = mocked(_shallowClone);

const gitRepoBuilder = createBuilder(gitRepositorySchema);

describe('git', () => {
  let store;
  beforeEach(async () => {
    await globalBeforeEach();
    store = mockStore(await reduxStateForTest());
    gitRepoBuilder.reset();
  });

  // Check loading events
  afterEach(() => {
    const actions = store.getActions();
    // Should always contain one LOAD_START and one LOAD_END
    expect(actions.filter(({ type }) => type === LOAD_START)).toHaveLength(1);
    expect(actions.filter(({ type }) => type === LOAD_STOP)).toHaveLength(1);
    // LOAD_START should never be before LOAD_STOP
    const startActionIndex = actions.findIndex(({ type }) => type === LOAD_START);
    const stopActionIndex = actions.findIndex(({ type }) => type === LOAD_STOP);
    expect(stopActionIndex).toBeGreaterThan(startActionIndex);
  });

  describe('cloneGitRepository', () => {
    const dispatchCloneAndSubmitSettings = async (memClient: PromiseFsClient, uri?: string) => {
      const createFsClientMock = jest.fn().mockReturnValue(memClient);
      // dispatch clone action
      store.dispatch(
        cloneGitRepository({
          createFsClient: createFsClientMock,
        }),
      );
      const { onSubmitEdits } = getAndClearShowModalMockArgs();

      // Submit GitRepositorySettingsModal with repo settings
      const repoSettings = gitRepoBuilder.build();

      if (uri) {
        repoSettings.uri = uri;
      }

      await onSubmitEdits(repoSettings);
      return {
        repoSettings,
        createFsClientMock,
      };
    };

    const shouldPromptToCreateWorkspace = async (memClient: PromiseFsClient) => {
      const { repoSettings } = await dispatchCloneAndSubmitSettings(memClient);
      expect(trackEvent).toHaveBeenCalledWith('Git', 'Clone');
      // show alert asking to create a document
      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('No document found');
      expect(alertArgs.okLabel).toBe('Yes');
      expect(alertArgs.addCancel).toBe(true);
      expect(alertArgs.message).toBe(
        'No document found in the repository for import. Would you like to create a new one?',
      );
      // Confirm
      await alertArgs.onConfirm?.();
      // Should show new design doc prompt
      const promptArgs = getAndClearShowPromptMockArgs();
      expect(promptArgs.title).toBe('Create New Design Document');
      // Submit new design doc name
      await promptArgs.onComplete?.('name');
      // Ensure workspace created
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace.name).toBe('name');
      expect(workspace.scope).toBe(WorkspaceScopeKeys.design);
      // Ensure git repo is linked
      const meta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(meta?.gitRepositoryId).toBe(repoSettings._id);
      // Ensure tracking events
      expect(trackSegmentEvent).toHaveBeenCalledWith(SegmentEvent.documentCreate);
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
        {
          type: SET_ACTIVE_PROJECT,
          projectId: DEFAULT_PROJECT_ID,
        },
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspace._id,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_SPEC,
        },
      ]);
    };

    it('should prompt to create workspace if no GIT_INSOMNIA_DIR found', async () => {
      const memClient = MemClient.createClient();
      await shouldPromptToCreateWorkspace(memClient);
    });

    it('should prompt to create workspace if no GIT_INSOMNIA_DIR/workspace found', async () => {
      const memClient = MemClient.createClient();
      await memClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await shouldPromptToCreateWorkspace(memClient);
    });

    it('should prompt to create workspace if no GIT_INSOMNIA_DIR/workspace/wrk_*.json found', async () => {
      const memClient = MemClient.createClient();
      await memClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await memClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));
      await shouldPromptToCreateWorkspace(memClient);
    });

    it('should fail if multiple workspaces found', async () => {
      const memClient = MemClient.createClient();
      await memClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await memClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));
      const wrk1Json = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_1.json');
      const wrk2Json = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_2.json');
      await memClient.promises.writeFile(wrk1Json, '{}');
      await memClient.promises.writeFile(wrk2Json, '{}');
      await dispatchCloneAndSubmitSettings(memClient);
      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('Clone Problem');
      expect(alertArgs.message).toBe('Multiple workspaces found in repository; expected one.');
      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
    });

    it('should fail if workspace already exists', async () => {
      const memClient = MemClient.createClient();
      await memClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await memClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));
      const workspace = await models.workspace.create();
      const workspaceJson = path.join(
        GIT_INSOMNIA_DIR,
        models.workspace.type,
        `${workspace._id}.json`,
      );
      await memClient.promises.writeFile(workspaceJson, JSON.stringify(workspace));
      await dispatchCloneAndSubmitSettings(memClient);
      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('Clone Problem');
      expect(alertArgs.message).toStrictEqual(
        <Fragment>
          Workspace <strong>New Collection</strong> already exists. Please delete it before cloning.
        </Fragment>,
      );
      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
    });

    it('should fail if exception during clone and not try again if uri ends with .git', async () => {
      const memClient = MemClient.createClient();
      const err = new Error('some error');
      shallowClone.mockRejectedValue(err);
      await dispatchCloneAndSubmitSettings(memClient, 'https://git.com.git');
      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('Error Cloning Repository');
      expect(alertArgs.message).toBe(err.message);
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
      expect(shallowClone).toHaveBeenCalledTimes(1);
    });

    it('should show combined error if clone with and without .git suffix fails', async () => {
      const memClient = MemClient.createClient();
      const firstError = new Error('first error');
      shallowClone.mockRejectedValueOnce(firstError);
      const secondError = new Error('second error');
      shallowClone.mockRejectedValueOnce(secondError);
      const uri = 'https://git.com';
      const dotGitUri = `${uri}.git`;
      await dispatchCloneAndSubmitSettings(memClient, uri);
      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe(
        'Error Cloning Repository: failed to clone with and without `.git` suffix',
      );
      expect(alertArgs.message).toBe(
        `Failed to clone with original url (${uri}): ${firstError.message};\n\nAlso failed to clone with \`.git\` suffix added (${dotGitUri}): ${secondError.message}`,
      );
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
      expect(shallowClone).toHaveBeenCalledTimes(2);
    });

    const createValidRepoFiles = async (memClient: PromiseFsClient) => {
      // Create workspace and apiSpec dirs
      await memClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await memClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));
      await memClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.apiSpec.type));
      // Write workspace file
      const workspace = await models.workspace.create({
        scope: WorkspaceScopeKeys.design,
      });
      const workspaceJson = path.join(
        GIT_INSOMNIA_DIR,
        models.workspace.type,
        `${workspace._id}.json`,
      );
      await models.workspace.remove(workspace);
      await memClient.promises.writeFile(workspaceJson, JSON.stringify(workspace));
      // Write ApiSpec file
      const apiSpec = await models.apiSpec.getOrCreateForParentId(workspace._id);
      const apiSpecJson = path.join(GIT_INSOMNIA_DIR, models.apiSpec.type, `${apiSpec._id}.json`);
      await models.apiSpec.removeWhere(workspace._id);
      await memClient.promises.writeFile(apiSpecJson, JSON.stringify(apiSpec));
      return {
        workspace,
        apiSpec,
      };
    };

    const confirmImport = async workspace => {
      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('Project Found');
      expect(alertArgs.okLabel).toBe('Import');
      expect(alertArgs.message).toStrictEqual(
        <Fragment>
          Workspace <strong>{workspace.name}</strong> found in repository. Would you like to import
          it?
        </Fragment>,
      );
      await alertArgs.onConfirm?.();
    };

    it('should retry clone with .git suffix and succeed', async () => {
      const memClient = MemClient.createClient();
      const { workspace } = await createValidRepoFiles(memClient);
      // Mock clone
      const err = new Error('some error');
      shallowClone.mockRejectedValueOnce(err);
      shallowClone.mockResolvedValueOnce();
      // Dispatch
      const uri = 'https://git.com/abc/def';
      const { createFsClientMock, repoSettings } = await dispatchCloneAndSubmitSettings(
        memClient,
        uri,
      );
      // Show confirmation
      await confirmImport(workspace);
      // Expect clone called twice
      expect(createFsClientMock).toHaveBeenCalledTimes(2);
      expect(shallowClone).toHaveBeenCalledTimes(2);
      expect(shallowClone).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          fsClient: memClient,
          gitRepository: expect.objectContaining({
            uri,
          }),
        }),
      );
      expect(shallowClone).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          fsClient: memClient,
          gitRepository: expect.objectContaining({
            uri: `${uri}.git`,
          }),
        }),
      );
      // Because second clone succeeds, store the updated URL
      const createdRepo = await models.gitRepository.getById(repoSettings._id);
      expect(createdRepo?.needsFullClone).toBe(true);
      expect(createdRepo?.uri).toBe(`${uri}.git`);
    });

    it('should import workspace and apiSpec', async () => {
      const memClient = MemClient.createClient();
      const { workspace, apiSpec } = await createValidRepoFiles(memClient);
      // Clone
      const { repoSettings } = await dispatchCloneAndSubmitSettings(memClient);
      // Show confirmation
      await confirmImport(workspace);
      // Ensure workspace imported
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const clonedWorkspace = workspaces[0];
      expect(clonedWorkspace).toStrictEqual(workspace);
      // Ensure ApiSpec imported
      const apiSpecs = await models.apiSpec.all();
      expect(apiSpecs).toHaveLength(1);
      const clonedApiSpec = apiSpecs[0];
      expect(clonedApiSpec).toStrictEqual(apiSpec);
      // Ensure git repo is linked
      const meta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(meta?.gitRepositoryId).toBe(repoSettings._id);
      const createdRepo = await models.gitRepository.getById(repoSettings._id);
      expect(createdRepo?.needsFullClone).toBe(true);
      // Ensure workspace is enabled
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
    });
  });

  describe('setupGitRepository', () => {
    const dispatchSetupAndSubmitSettings = async (
      memClient: PromiseFsClient,
      workspace: Workspace,
    ) => {
      // dispatch clone action
      store.dispatch(
        setupGitRepository({
          createFsClient: () => memClient,
          workspace,
        }),
      );
      const { onSubmitEdits } = getAndClearShowModalMockArgs();
      // Submit GitRepositorySettingsModal with repo settings
      const repoSettings = gitRepoBuilder.build();
      await onSubmitEdits(repoSettings);
      return repoSettings;
    };

    it('should fail if exception during clone', async () => {
      const memClient = MemClient.createClient();
      const workspace = await models.workspace.create({
        scope: WorkspaceScopeKeys.design,
      });
      const err = new Error('some error');
      shallowClone.mockRejectedValue(err);
      await dispatchSetupAndSubmitSettings(memClient, workspace);
      const errorArgs = getAndClearShowErrorMockArgs();
      expect(errorArgs.title).toBe('Error Cloning Repository');
      expect(errorArgs.message).toBe(err.message);
      expect(errorArgs.error).toBe(err);
      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
    });

    it('should fail if workspace is found', async () => {
      const memClient = MemClient.createClient();
      const workspace = await models.workspace.create({
        scope: WorkspaceScopeKeys.design,
      });
      await memClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await memClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));
      const wrk1Json = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_1.json');
      const wrk2Json = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_2.json');
      await memClient.promises.writeFile(wrk1Json, '{}');
      await memClient.promises.writeFile(wrk2Json, '{}');
      await dispatchSetupAndSubmitSettings(memClient, workspace);
      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('Setup Problem');
      expect(alertArgs.message).toBe(
        'This repository already contains a workspace; create a fresh clone from the dashboard.',
      );
      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
    });

    it('should setup if no .insomnia directory is found', async () => {
      const memClient = MemClient.createClient();
      const workspace = await models.workspace.create({
        scope: WorkspaceScopeKeys.design,
      });
      const repo = await dispatchSetupAndSubmitSettings(memClient, workspace);
      const wMeta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(wMeta?.gitRepositoryId).toBe(repo._id);
      const createdRepo = await models.gitRepository.getById(repo._id);
      expect(createdRepo?.needsFullClone).toBe(true);
      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
    });

    it('should setup if empty .insomnia directory is found', async () => {
      const memClient = MemClient.createClient();
      const workspace = await models.workspace.create({
        scope: WorkspaceScopeKeys.design,
      });
      await memClient.promises.mkdir(GIT_INSOMNIA_DIR);
      const repo = await dispatchSetupAndSubmitSettings(memClient, workspace);
      const wMeta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(wMeta?.gitRepositoryId).toBe(repo._id);
      const createdRepo = await models.gitRepository.getById(repo._id);
      expect(createdRepo?.needsFullClone).toBe(true);
      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
    });

    it('should setup if empty .insomnia/workspace directory is found', async () => {
      const memClient = MemClient.createClient();
      const workspace = await models.workspace.create({
        scope: WorkspaceScopeKeys.design,
      });
      await memClient.promises.mkdir(GIT_INSOMNIA_DIR);
      await memClient.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));
      const repo = await dispatchSetupAndSubmitSettings(memClient, workspace);
      const wMeta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(wMeta?.gitRepositoryId).toBe(repo._id);
      const createdRepo = await models.gitRepository.getById(repo._id);
      expect(createdRepo?.needsFullClone).toBe(true);
      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        {
          type: LOAD_START,
        },
        {
          type: LOAD_STOP,
        },
      ]);
    });
  });
});
