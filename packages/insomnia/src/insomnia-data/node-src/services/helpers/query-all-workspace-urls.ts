import type { GrpcRequest, Request } from '~/insomnia-data';
import { database as db } from '~/insomnia-data';

import * as workspaceService from '../workspace';

export const queryAllWorkspaceUrls = async (
  workspaceId: string,
  reqType: Request['type'] | GrpcRequest['type'],
  reqId = 'n/a',
): Promise<string[]> => {
  const workspace = await workspaceService.getById(workspaceId);

  if (!workspace) {
    throw new Error(`Workspace ${workspaceId} not found`);
  }

  const docs = (await db.getWithDescendants(workspace, [reqType])) as (Request | GrpcRequest)[];
  const urls = docs
    .filter(doc => doc.type === reqType && doc._id !== reqId && (doc.url || ''))
    .map(doc => (doc.url || '').trim());

  return Array.from(new Set(urls));
};
