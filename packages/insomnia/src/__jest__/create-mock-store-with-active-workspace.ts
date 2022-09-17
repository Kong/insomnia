import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { ACTIVITY_DEBUG } from '../common/constants';
import * as models from '../models';
import { Workspace } from '../models/workspace';
import { WorkspaceMeta } from '../models/workspace-meta';
import { RootState } from '../ui/redux/modules';
import { reduxStateForTest } from './redux-state-for-test';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

export const createMockStoreWithWorkspace = async ({ workspacePatch, workspaceMetaPatch }: { workspacePatch?: Partial<Workspace>; workspaceMetaPatch?: Partial<WorkspaceMeta> } = {}) => {
  const { _id: projectId } = await models.project.create();
  const { _id: workspaceId } = await models.workspace.create({ parentId: projectId, ...workspacePatch });
  await models.workspaceMeta.create({ parentId: workspaceId, ...workspaceMetaPatch });

  const store = mockStore(await reduxStateForTest({
    activeProjectId: projectId,
    activeWorkspaceId: workspaceId,
    activeActivity: ACTIVITY_DEBUG,
  }));

  return {
    store,
    workspaceId,
  };
};
