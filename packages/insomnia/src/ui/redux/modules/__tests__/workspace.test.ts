import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { globalBeforeEach } from '../../../../__jest__/before-each';
import { reduxStateForTest } from '../../../../__jest__/redux-state-for-test';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST } from '../../../../common/constants';
import * as models from '../../../../models';
import { SET_ACTIVE_ACTIVITY, SET_ACTIVE_PROJECT, SET_ACTIVE_WORKSPACE } from '../global';
import { activateWorkspace } from '../workspace';

jest.mock('../../../components/modals');
jest.mock('../../../../ui/analytics');

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('workspace', () => {
  beforeEach(globalBeforeEach);
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
