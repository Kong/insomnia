import { database as db } from '../../common/database';
import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import type { GrpcRequest } from '../grpc-request';
import type { Request } from '../request';

export const queryAllWorkspaceUrls = async (
  workspaceId: string,
  reqType: 'Request' | 'GrpcRequest',
  reqId = 'n/a',
): Promise<string[]> => {
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, `Workspace ${workspaceId} not found`);
  const docs = (await db.getWithDescendants(workspace, [reqType])) as (Request | GrpcRequest)[];
  const urls = docs
    .filter(
      d =>
        d.type === reqType &&
        d._id !== reqId && // Not current request
        (d.url || ''), // Only ones with non-empty URLs
    )
    .map((r: Request | GrpcRequest) => (r.url || '').trim());
  return Array.from(new Set(urls));
};
