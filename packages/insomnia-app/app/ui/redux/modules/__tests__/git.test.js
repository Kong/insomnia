// @flow
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import { WorkspaceScopeKeys } from '../../../../models/workspace';
import * as models from '../../../../models';
import { trackEvent, trackSegmentEvent } from '../../../../common/analytics';
import { ACTIVITY_SPEC } from '../../../../common/constants';
import { LOAD_START, LOAD_STOP, SET_ACTIVE_ACTIVITY, SET_ACTIVE_WORKSPACE } from '../global';
import { MemPlugin } from '../../../../sync/git/mem-plugin';
import { generateId } from '../../../../common/misc';
import { GIT_INSOMNIA_DIR } from '../../../../sync/git/git-vcs';
import path from 'path';
import * as React from 'react';
import * as git from 'isomorphic-git';
import { cloneGitRepository } from '../git';
import {
  getAndClearShowAlertMockArgs,
  getAndClearShowErrorMockArgs,
  getAndClearShowModalMockArgs,
  getAndClearShowPromptMockArgs,
} from '../../../../test-utils';

jest.mock('../../../components/modals');
jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('workspace', () => {
  beforeEach(globalBeforeEach);

  describe('cloneGitRepository', () => {
    let store;
    beforeEach(() => {
      store = mockStore();
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

    const shouldPromptToCreateWorkspace = async memPlugin => {
      const repoSettings = await dispatchCloneAndSubmitSettings(memPlugin);

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
      await alertArgs.onConfirm();

      // Should show new design doc prompt
      const promptArgs = getAndClearShowPromptMockArgs();
      expect(promptArgs.title).toBe('Create New Design Document');

      // Submit new design doc name
      await promptArgs.onComplete('name');

      // Ensure workspace created
      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace.name).toBe('name');
      expect(workspace.scope).toBe(WorkspaceScopeKeys.design);

      // Ensure git repo is linked
      const meta = await models.workspaceMeta.getByParentId(workspace._id);
      expect(meta.gitRepositoryId).toBe(repoSettings._id);

      // Ensure tracking events
      expect(trackSegmentEvent).toHaveBeenCalledWith('Document Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');

      // Ensure activity is activated
      expect(store.getActions()).toEqual([
        { type: LOAD_START },
        { type: LOAD_STOP },
        { type: SET_ACTIVE_WORKSPACE, workspaceId: workspace._id },
        { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_SPEC },
      ]);
    };

    const dispatchCloneAndSubmitSettings = async memPlugin => {
      // dispatch clone action
      store.dispatch(cloneGitRepository({ createFsPlugin: () => memPlugin }));

      const { onSubmitEdits } = getAndClearShowModalMockArgs();

      // Submit GitRepositorySettingsModal with repo settings
      const repoSettings = models.gitRepository.init();
      repoSettings._id = generateId(models.gitRepository.prefix);
      await onSubmitEdits(repoSettings);
      return repoSettings;
    };

    it('should prompt to create workspace if no GIT_INSOMNIA_DIR found', async () => {
      const memPlugin = MemPlugin.createPlugin();

      await shouldPromptToCreateWorkspace(memPlugin);
    });

    it('should prompt to create workspace if no GIT_INSOMNIA_DIR/workspace found', async () => {
      const memPlugin = MemPlugin.createPlugin();
      await memPlugin.promises.mkdir(GIT_INSOMNIA_DIR);

      await shouldPromptToCreateWorkspace(memPlugin);
    });

    it('should prompt to create workspace if no GIT_INSOMNIA_DIR/workspace/wrk_*.json found', async () => {
      const memPlugin = MemPlugin.createPlugin();
      await memPlugin.promises.mkdir(GIT_INSOMNIA_DIR);
      await memPlugin.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));

      await shouldPromptToCreateWorkspace(memPlugin);
    });

    it('should fail if multiple workspaces found', async () => {
      const memPlugin = MemPlugin.createPlugin();

      await memPlugin.promises.mkdir(GIT_INSOMNIA_DIR);
      await memPlugin.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));

      const wrk1Json = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_1.json');
      const wrk2Json = path.join(GIT_INSOMNIA_DIR, models.workspace.type, 'wrk_2.json');

      await memPlugin.promises.writeFile(wrk1Json, '{}');
      await memPlugin.promises.writeFile(wrk2Json, '{}');

      await dispatchCloneAndSubmitSettings(memPlugin);

      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('Clone Problem');
      expect(alertArgs.message).toBe('Multiple workspaces found in repository; expected one.');

      // Ensure activity is activated
      expect(store.getActions()).toEqual([{ type: LOAD_START }, { type: LOAD_STOP }]);
    });

    it('should fail if workspace already exists', async () => {
      const memPlugin = MemPlugin.createPlugin();

      await memPlugin.promises.mkdir(GIT_INSOMNIA_DIR);
      await memPlugin.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));

      const workspace = await models.workspace.create();
      const workspaceJson = path.join(
        GIT_INSOMNIA_DIR,
        models.workspace.type,
        `${workspace._id}.json`,
      );

      await memPlugin.promises.writeFile(workspaceJson, JSON.stringify(workspace));
      await dispatchCloneAndSubmitSettings(memPlugin);

      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('Clone Problem');
      expect(alertArgs.message).toStrictEqual(
        <React.Fragment>
          Workspace <strong>New Collection</strong> already exists. Please delete it before cloning.
        </React.Fragment>,
      );

      // Ensure activity is activated
      expect(store.getActions()).toEqual([{ type: LOAD_START }, { type: LOAD_STOP }]);
    });

    it('should fail if exception during clone', async () => {
      const memPlugin = MemPlugin.createPlugin();
      const err = new Error('some error');
      (git.clone: JestMockFn).mockRejectedValue(err);
      await dispatchCloneAndSubmitSettings(memPlugin);
      const errorArgs = getAndClearShowErrorMockArgs();

      expect(errorArgs.title).toBe('Error Cloning Repository');
      expect(errorArgs.message).toBe(err.message);
      expect(errorArgs.error).toBe(err);

      // Ensure activity is activated
      expect(store.getActions()).toEqual([{ type: LOAD_START }, { type: LOAD_STOP }]);
    });

    it('should import workspace and apiSpec', async () => {
      const memPlugin = MemPlugin.createPlugin();

      // Create workspace and apiSpec dirs
      await memPlugin.promises.mkdir(GIT_INSOMNIA_DIR);
      await memPlugin.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.workspace.type));
      await memPlugin.promises.mkdir(path.join(GIT_INSOMNIA_DIR, models.apiSpec.type));

      // Write workspace file
      const workspace = await models.workspace.create({ scope: WorkspaceScopeKeys.design });
      const workspaceJson = path.join(
        GIT_INSOMNIA_DIR,
        models.workspace.type,
        `${workspace._id}.json`,
      );
      await models.workspace.remove(workspace);
      await memPlugin.promises.writeFile(workspaceJson, JSON.stringify(workspace));

      // Write ApiSpec file
      const apiSpec = await models.apiSpec.getOrCreateForParentId(workspace._id);
      const apiSpecJson = path.join(GIT_INSOMNIA_DIR, models.apiSpec.type, `${apiSpec._id}.json`);
      await models.apiSpec.removeWhere(workspace._id);
      await memPlugin.promises.writeFile(apiSpecJson, JSON.stringify(apiSpec));

      // Clone
      const repoSettings = await dispatchCloneAndSubmitSettings(memPlugin);

      // Show confirmation
      const alertArgs = getAndClearShowAlertMockArgs();
      expect(alertArgs.title).toBe('Project Found');
      expect(alertArgs.okLabel).toBe('Import');
      expect(alertArgs.message).toStrictEqual(
        <React.Fragment>
          Workspace <strong>{workspace.name}</strong> found in repository. Would you like to import
          it?
        </React.Fragment>,
      );

      await alertArgs.onConfirm();

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
      expect(meta.gitRepositoryId).toBe(repoSettings._id);

      // Ensure workspace is enabled
      expect(store.getActions()).toEqual([
        { type: LOAD_START },
        { type: SET_ACTIVE_WORKSPACE, workspaceId: workspace._id },
        { type: LOAD_STOP },
      ]);
    });
  });
});
