import type { GrpcRequest, models } from '~/insomnia-data';
import { services } from '~/insomnia-data';

import { database as db } from '../../common/database';
import { invariant } from '../../utils/invariant';
import type { Request, type as RequestType } from '../request';

export const queryAllWorkspaceUrls = async (
  workspaceId: string,
  reqType: typeof RequestType | typeof models.grpcRequest.type,
  reqId = 'n/a',
): Promise<string[]> => {
  const workspace = await services.workspace.getById(workspaceId);
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
