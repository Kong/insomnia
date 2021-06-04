import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import { createWorkspace } from '../workspace';
import { WorkspaceScopeKeys } from '../../../../models/workspace';
import * as models from '../../../../models';
import { trackEvent, trackSegmentEvent } from '../../../../common/analytics';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../../../common/constants';
import { SET_ACTIVE_ACTIVITY, SET_ACTIVE_WORKSPACE } from '../global';
import { getAndClearShowPromptMockArgs } from '../../../../test-utils';

jest.mock('../../../components/modals');
jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const createSpace = async () => await models.initModel(models.space.type);

describe('workspace', () => {
  beforeEach(globalBeforeEach);
  describe('createWorkspace', () => {
    it('should create document', async () => {
      const space = await createSpace();
      const entities = { spaces: { [space._id]: space } };
      const global = { activeSpaceId: space._id };
      const store = mockStore({ entities, global });

      store.dispatch(
        createWorkspace({
          scope: WorkspaceScopeKeys.design,
        }),
      );
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
      expect(workspace.parentId).toBe(space._id);
      expect(trackSegmentEvent).toHaveBeenCalledWith('Document Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspace._id,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_SPEC,
        },
      ]);
    });

    it('should create collection', async () => {
      const space = await createSpace();
      const entities = { spaces: { [space._id]: space } };
      const global = { activeSpaceId: space._id };
      const store = mockStore({ entities, global });

      store.dispatch(
        createWorkspace({
          scope: WorkspaceScopeKeys.collection,
        }),
      );
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
      expect(workspace.parentId).toBe(space._id);
      expect(trackSegmentEvent).toHaveBeenCalledWith('Collection Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspace._id,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_DEBUG,
        },
      ]);
    });

    it('should create with no space', async () => {
      const entities = { spaces: {} };
      const global = { };
      const store = mockStore({ entities, global });

      store.dispatch(
        createWorkspace({
          scope: WorkspaceScopeKeys.collection,
        }),
      );
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
      expect(workspace.parentId).toBe(null);
      expect(trackSegmentEvent).toHaveBeenCalledWith('Collection Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspace._id,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_DEBUG,
        },
      ]);
    });
  });
});
