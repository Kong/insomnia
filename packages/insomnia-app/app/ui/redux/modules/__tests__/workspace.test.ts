import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { SegmentEvent, trackEvent, trackSegmentEvent } from '../../../../common/analytics';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST } from '../../../../common/constants';
import { database } from '../../../../common/database';
import * as models from '../../../../models';
import { ApiSpec } from '../../../../models/api-spec';
import { CookieJar } from '../../../../models/cookie-jar';
import { Environment } from '../../../../models/environment';
import { DEFAULT_PROJECT_ID } from '../../../../models/project';
import { Workspace, WorkspaceScope, WorkspaceScopeKeys } from '../../../../models/workspace';
import { WorkspaceMeta } from '../../../../models/workspace-meta';
import { getAndClearShowPromptMockArgs } from '../../../../test-utils';
import { SET_ACTIVE_ACTIVITY, SET_ACTIVE_PROJECT, SET_ACTIVE_WORKSPACE } from '../global';
import { activateWorkspace, createWorkspace } from '../workspace';

jest.mock('../../../components/modals');
jest.mock('../../../../common/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const expectedModelsCreated = async (name: string, scope: WorkspaceScope, parentId: string) => {
  const workspaces = await models.workspace.all();
  expect(workspaces).toHaveLength(1);
  const workspace = workspaces[0];

  const descendents = await database.withDescendants(workspace);

  expect(descendents).toHaveLength(5);
  expect(descendents).toStrictEqual(expect.arrayContaining([
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
      const projectId = DEFAULT_PROJECT_ID;
      const store = mockStore(await reduxStateForTest({ activeProjectId: projectId }));

      // @ts-expect-error redux-thunk types
      store.dispatch(createWorkspace({ scope: WorkspaceScopeKeys.design }));

      const { title, submitName, defaultValue, onComplete } = getAndClearShowPromptMockArgs();
      expect(title).toBe('Create New Design Document');
      expect(submitName).toBe('Create');
      expect(defaultValue).toBe('my-spec.yaml');
      const workspaceName = 'name';
      await onComplete?.(workspaceName);

      const workspaceId = await expectedModelsCreated(workspaceName, WorkspaceScopeKeys.design, projectId);

      expect(trackSegmentEvent).toHaveBeenCalledWith(SegmentEvent.documentCreate);
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: DEFAULT_PROJECT_ID,
        },
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
      const projectId = DEFAULT_PROJECT_ID;
      const store = mockStore(await reduxStateForTest({ activeProjectId: projectId }));

      // @ts-expect-error redux-thunk types
      store.dispatch(createWorkspace({ scope: WorkspaceScopeKeys.collection }));

      const { title, submitName, defaultValue, onComplete } = getAndClearShowPromptMockArgs();
      expect(title).toBe('Create New Request Collection');
      expect(submitName).toBe('Create');
      expect(defaultValue).toBe('My Collection');
      const workspaceName = 'name';
      await onComplete?.(workspaceName);

      const workspaceId = await expectedModelsCreated(workspaceName, WorkspaceScopeKeys.collection, projectId);

      expect(trackSegmentEvent).toHaveBeenCalledWith(SegmentEvent.collectionCreate);
      expect(trackEvent).toHaveBeenCalledWith('Workspace', 'Create');
      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: DEFAULT_PROJECT_ID,
        },
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

  describe('activateWorkspace', () => {
    it('should do nothing if workspace cannot be found', async () => {
      const store = mockStore(await reduxStateForTest({ activeProjectId: 'abc', activeWorkspaceId: 'def' }));

      await store.dispatch(activateWorkspace({ workspaceId: 'DOES_NOT_EXIST' }));

      expect(store.getActions()).toEqual([]);
    });

    it('should activate project and workspace and activity using workspaceId', async () => {
      const project = await models.project.create();
      const workspace = await models.workspace.create({ scope: 'design', parentId: project._id });
      const store = mockStore(await reduxStateForTest({ activeProjectId: 'abc', activeWorkspaceId: 'def' }));

      await store.dispatch(activateWorkspace({ workspaceId: workspace._id }));

      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: project._id,
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
    });

    it('should activate project and workspace and activity from home', async () => {
      const project = await models.project.create();
      const workspace = await models.workspace.create({ scope: 'design', parentId: project._id });
      const store = mockStore(await reduxStateForTest({ activeProjectId: 'abc', activeWorkspaceId: 'def' }));

      await store.dispatch(activateWorkspace({ workspace }));

      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: project._id,
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
    });

    it('should switch to the default design activity', async () => {
      const project = await models.project.create();
      const workspace = await models.workspace.create({ scope: 'design', parentId: project._id });
      const store = mockStore(await reduxStateForTest({ activeProjectId: project._id, activeWorkspaceId: workspace._id }));

      await store.dispatch(activateWorkspace({ workspace }));

      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: project._id,
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
    });

    it.each([ACTIVITY_UNIT_TEST, ACTIVITY_SPEC, ACTIVITY_DEBUG])('should not switch activity if already in a supported design activity: %s', async activeActivity => {
      const project = await models.project.create();
      const workspace = await models.workspace.create({ scope: 'design', parentId: project._id });
      const store = mockStore(await reduxStateForTest({ activeProjectId: project._id, activeWorkspaceId: workspace._id, activeActivity }));

      await store.dispatch(activateWorkspace({ workspace }));

      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: project._id,
        },
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspace._id,
        },
      ]);
    });

    it.each([ACTIVITY_DEBUG])('should not switch activity if already in a supported collection activity: %s', async activeActivity => {
      const project = await models.project.create();
      const workspace = await models.workspace.create({ scope: 'design', parentId: project._id });
      const store = mockStore(await reduxStateForTest({ activeProjectId: project._id, activeWorkspaceId: workspace._id, activeActivity }));

      await store.dispatch(activateWorkspace({ workspace }));

      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: project._id,
        },
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspace._id,
        },
      ]);
    });

    it('should switch to the default collection activity', async () => {
      const project = await models.project.create();
      const workspace = await models.workspace.create({ scope: 'collection', parentId: project._id });
      const store = mockStore(await reduxStateForTest({ activeProjectId: project._id, activeWorkspaceId: workspace._id }));

      await store.dispatch(activateWorkspace({ workspace }));

      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: project._id,
        },
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

    it('should switch to the cached activity', async () => {
      const project = await models.project.create();
      const workspace = await models.workspace.create({ scope: 'design', parentId: project._id });
      await models.workspace.ensureChildren(workspace);
      await models.workspaceMeta.updateByParentId(workspace._id, { activeActivity: ACTIVITY_UNIT_TEST });
      const store = mockStore(await reduxStateForTest({ activeProjectId: project._id, activeWorkspaceId: workspace._id }));

      await store.dispatch(activateWorkspace({ workspace }));

      expect(store.getActions()).toEqual([
        {
          type: SET_ACTIVE_PROJECT,
          projectId: project._id,
        },
        {
          type: SET_ACTIVE_WORKSPACE,
          workspaceId: workspace._id,
        },
        {
          type: SET_ACTIVE_ACTIVITY,
          activity: ACTIVITY_UNIT_TEST,
        },
      ]);
    });
  });
});
