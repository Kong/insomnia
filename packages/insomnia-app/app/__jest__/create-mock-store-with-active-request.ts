import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { ACTIVITY_DEBUG } from '../common/constants';
import * as models from '../models';
import { Request } from '../models/request';
import { RequestMeta } from '../models/request-meta';
import { RootState } from '../ui/redux/modules';
import { reduxStateForTest } from './redux-state-for-test';

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

export const createMockStoreWithRequest = async ({ requestPatch, requestMetaPatch }: { requestPatch?: Partial<Request>; requestMetaPatch?: Partial<RequestMeta> } = {}) => {
  const { _id: projectId } = await models.project.create();
  const { _id: workspaceId } = await models.workspace.create({ parentId: projectId });
  const { _id: requestId } = await models.request.create({ parentId: workspaceId, ...requestPatch });
  await models.requestMeta.create({ parentId: requestId, ...requestMetaPatch });
  await models.workspaceMeta.create({ parentId: workspaceId, activeRequestId: requestId });

  const store = mockStore(await reduxStateForTest({
    activeProjectId: projectId,
    activeWorkspaceId: workspaceId,
    activeActivity: ACTIVITY_DEBUG,
  }));

  return {
    store,
    requestId,
  };
};
