import type { GrpcRequest, models, Request } from '~/insomnia-data';
import { database as db } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';

import * as workspaceService from '../workspace';

export const queryAllWorkspaceUrls = async (
  workspaceId: string,
  reqType: typeof models.request.type | typeof models.grpcRequest.type,
  reqId = 'n/a',
): Promise<string[]> => {
  const workspace = await workspaceService.getById(workspaceId);
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
