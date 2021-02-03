// @flow
import { useCallback } from 'react';
import * as models from '../../../../models';
import { queryAllWorkspaceUrls } from '../../../../models/helpers/query-all-workspace-urls';

const useExistingGrpcUrls = (workspaceId: string, requestId?: string) =>
  useCallback(async () => {
    const workspace = await models.workspace.getById(workspaceId);
    return queryAllWorkspaceUrls(workspace, models.grpcRequest.type, requestId);
  }, [requestId, workspaceId]);

export default useExistingGrpcUrls;
