import type { models } from '~/insomnia-data';
import { database as db, type GrpcRequest, type Request, services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';

export const queryAllWorkspaceUrls = async (
  workspaceId: string,
  reqType: typeof models.request.type | typeof models.grpcRequest.type,
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
