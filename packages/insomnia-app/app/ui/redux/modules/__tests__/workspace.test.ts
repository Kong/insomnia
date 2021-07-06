import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { globalBeforeEach } from '../../../../__jest__/before-each';
import { createWorkspace } from '../workspace';
import { Workspace, WorkspaceScope, WorkspaceScopeKeys } from '../../../../models/workspace';
import * as models from '../../../../models';
import { trackEvent, trackSegmentEvent } from '../../../../common/analytics';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../../../common/constants';
import { SET_ACTIVE_ACTIVITY, SET_ACTIVE_WORKSPACE } from '../global';
import { getAndClearShowPromptMockArgs } from '../../../../test-utils';
import { database } from '../../../../common/database';
import { Environment } from '../../../../models/environment';
import { CookieJar } from '../../../../models/cookie-jar';
import { WorkspaceMeta } from '../../../../models/workspace-meta';
import { ApiSpec } from '../../../../models/api-spec';
import reduxStateForTest from '../../../../__jest__/redux-state-for-test';

jest.mock('../../../components/modals');
jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const createStoreWithSpace = async () => {
  const space = await models.initModel(models.space.type);

  const entities = { spaces: { [space._id]: space } };
  const global = { activeSpaceId: space._id };
  const store = mockStore({ entities, global });
  return { store, space };
};

const expectedModelsCreated = async (name: string, scope: WorkspaceScope, parentId: string | null = null) => {
  const workspaces = await models.workspace.all();
  expect(workspaces).toHaveLength(1);
  const workspace = workspaces[0];

  const descendents = await database.withDescendants(workspace);

  expect(descendents).toHaveLength(5);
  expect(descendents).toStrictEqual(expect.arrayContaining([
    // @ts-expect-error parentId is nullable for workspaces
    expect.objectContaining<Partial<Workspace>>({ name, scope, parentId, type: models.workspace.type }),
    expect.objectContaining<Partial<ApiSpec>>({ parentId: workspace._id, type: models.apiSpec.type }),
    expect.objectContaining<Partial<Environment>>({ parentId: workspace._id, type: models.environment.type }),
    expect.objectContaining<Partial<CookieJar>>({ parentId: workspace._id, type: models.cookieJar.type }),
    expect.objectContaining<Partial<WorkspaceMeta>>({ parentId: workspace._id, type: models.workspaceMeta.type }),
  ]));

  return workspace._id;
};

describe('workspace', () => {
  beforeEach(globalBeforeEach);
  describe('createWorkspace', () => {
    it('should create document', async () => {
      const { store, space } = await createStoreWithSpace();

      // @ts-expect-error redux-thunk types
      store.dispatch(createWorkspace({ scope: WorkspaceScopeKeys.design }));

      const { title, submitName, defaultValue, onComplete } = getAndClearShowPromptMockArgs();
      expect(title).toBe('Create New Design Document');
      expect(submitName).toBe('Create');
      expect(defaultValue).toBe('my-spec.yaml');
      const workspaceName = 'name';
      await onComplete?.(workspaceName);

      const workspaceId = await expectedModelsCreated(workspaceName, WorkspaceScopeKeys.design, space._id);

      expect(trackSegmentEvent).toHaveBeenCalledWith('Document Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspaceId,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_SPEC,
        },
      ]);
    });

    it('should create collection', async () => {
      const { store, space } = await createStoreWithSpace();

      // @ts-expect-error redux-thunk types
      store.dispatch(createWorkspace({ scope: WorkspaceScopeKeys.collection }));

      const { title, submitName, defaultValue, onComplete } = getAndClearShowPromptMockArgs();
      expect(title).toBe('Create New Request Collection');
      expect(submitName).toBe('Create');
      expect(defaultValue).toBe('My Collection');
      const workspaceName = 'name';
      await onComplete?.(workspaceName);

      const workspaceId = await expectedModelsCreated(workspaceName, WorkspaceScopeKeys.collection, space._id);

      expect(trackSegmentEvent).toHaveBeenCalledWith('Collection Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspaceId,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_DEBUG,
        },
      ]);
    });

    it('should create with no space', async () => {
      const store = mockStore(await reduxStateForTest());

      // @ts-expect-error redux-thunk types
      store.dispatch(createWorkspace({ scope: WorkspaceScopeKeys.collection }));

      const { title, submitName, defaultValue, onComplete } = getAndClearShowPromptMockArgs();
      expect(title).toBe('Create New Request Collection');
      expect(submitName).toBe('Create');
      expect(defaultValue).toBe('My Collection');
      const workspaceName = 'name';
      await onComplete?.(workspaceName);

      const workspaceId = await expectedModelsCreated(workspaceName, WorkspaceScopeKeys.collection);

      expect(trackSegmentEvent).toHaveBeenCalledWith('Collection Created');
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspaceId,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_DEBUG,
        },
      ]);
    });
  });
});
