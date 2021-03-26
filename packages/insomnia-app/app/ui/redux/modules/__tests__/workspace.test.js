// @flow
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import { createWorkspace, gitCloneWorkspace } from '../workspace';
import { WorkspaceScopeKeys } from '../../../../models/workspace';
import * as modals from '../../../components/modals';
import * as models from '../../../../models';
import { trackEvent, trackSegmentEvent } from '../../../../common/analytics';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../../../common/constants';
import { SET_ACTIVE_ACTIVITY, SET_ACTIVE_WORKSPACE } from '../global';
import { MemPlugin } from '../../../../sync/git/mem-plugin';
import { generateId } from '../../../../common/misc';

jest.mock('../../../components/modals');
jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const getAndClearShowPromptMockArgs = () => {
  const mockFn = (modals.showPrompt: JestMockFn);
  const { title, submitName, defaultValue, onComplete } = mockFn.mock.calls[0][0];
  mockFn.mockClear();

  return { title, submitName, defaultValue, onComplete };
};

const getAndClearShowAlertMockArgs = () => {
  const mockFn = (modals.showAlert: JestMockFn);
  const { title, okLabel, addCancel, message, onConfirm } = mockFn.mock.calls[0][0];
  mockFn.mockClear();

  return { title, okLabel, addCancel, message, onConfirm };
};

const getAndClearShowModalMockArgs = () => {
  const mockFn = (modals.showModal: JestMockFn);
  const args = mockFn.mock.calls[0][1];
  mockFn.mockClear();

  return args;
};

describe('workspace', () => {
  beforeEach(globalBeforeEach);

  describe('createWorkspace', () => {
    it('should create document', async () => {
      const store = mockStore();

      store.dispatch(createWorkspace({ scope: WorkspaceScopeKeys.design }));

      const { title, submitName, defaultValue, onComplete } = getAndClearShowPromptMockArgs();
      expect(title).toBe('Create New Design Document');
      expect(submitName).toBe('Create');
      expect(defaultValue).toBe('my-spec.yaml');

      const workspaceName = 'name';
      await onComplete(workspaceName);

      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace.name).toBe(workspaceName);
      expect(workspace.scope).toBe(WorkspaceScopeKeys.design);

      expect(trackSegmentEvent).toHaveBeenCalledWith('Document Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');

      expect(store.getActions()).toEqual([
        { type: SET_ACTIVE_WORKSPACE, workspaceId: workspace._id },
        { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_SPEC },
      ]);
    });

    it('should create workspace', async () => {
      const store = mockStore();

      store.dispatch(createWorkspace({ scope: WorkspaceScopeKeys.collection }));

      const { title, submitName, defaultValue, onComplete } = getAndClearShowPromptMockArgs();
      expect(title).toBe('Create New Request Collection');
      expect(submitName).toBe('Create');
      expect(defaultValue).toBe('My Collection');

      const workspaceName = 'name';
      await onComplete(workspaceName);

      const workspaces = await models.workspace.all();
      expect(workspaces).toHaveLength(1);
      const workspace = workspaces[0];
      expect(workspace.name).toBe(workspaceName);
      expect(workspace.scope).toBe(WorkspaceScopeKeys.collection);

      expect(trackSegmentEvent).toHaveBeenCalledWith('Collection Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');

      expect(store.getActions()).toEqual([
        { type: SET_ACTIVE_WORKSPACE, workspaceId: workspace._id },
        { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_DEBUG },
      ]);
    });
  });

  describe('gitCloneWorkspace', () => {
    it('should prompt to create workspace if no GIT_INSOMNIA_DIR_NAME found', async () => {
      const store = mockStore();
      const memPlugin = MemPlugin.createPlugin();

      // dispatch clone action
      store.dispatch(gitCloneWorkspace({ createFsPlugin: () => memPlugin }));

      const { onSubmitEdits } = getAndClearShowModalMockArgs();

      // Submit GitRepositorySettingsModal with repo settings
      const repoSettings = models.gitRepository.init();
      repoSettings._id = generateId(models.gitRepository.prefix);
      await onSubmitEdits(repoSettings);

      expect(trackEvent).toHaveBeenCalledWith('Git', 'Clone');

      // no GIT_INSOMNIA_DIR_NAME found, show alert asking to create a document
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
        { type: SET_ACTIVE_WORKSPACE, workspaceId: workspace._id },
        { type: SET_ACTIVE_ACTIVITY, activity: ACTIVITY_SPEC },
      ]);
    });
  });
});
