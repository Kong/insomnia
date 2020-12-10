// @flow

import * as db from '../../common/database';
import * as models from '../index';
import type { Workspace } from '../workspace';
import type { GrpcRequest } from '../grpc-request';

export const queryAllWorkspaceUrls = async (
  workspace: Workspace,
  reqType: models.request.type | models.grpcRequest.type,
  reqId?: string = 'n/a',
): Promise<Array<string>> => {
  const docs = await db.withDescendants(workspace, reqType);

  const urls = docs
    .filter(
      (d: any) =>
        d.type === reqType &&
        d._id !== reqId && // Not current request
        (d.url || ''), // Only ones with non-empty URLs
    )
    .map((r: Request | GrpcRequest) => (r.url || '').trim());

  return Array.from(new Set(urls));
};
