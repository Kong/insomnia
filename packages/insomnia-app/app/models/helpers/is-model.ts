import type { CollectionWorkspace, DesignWorkspace, Workspace } from '../workspace';
import { WorkspaceScopeKeys } from '../../models/workspace';
// TODO: Invalid until we can ensure all requests are prefixed by the id correctly INS-341
// export const isRequestId = (id: string) => id.startsWith(`${request.prefix}_`);

export const isDesign = (obj: Pick<Workspace, 'scope'>): obj is DesignWorkspace => (
  obj.scope === WorkspaceScopeKeys.design
);

export const isCollection = (obj: Pick<Workspace, 'scope'>): obj is CollectionWorkspace => (
  obj.scope === WorkspaceScopeKeys.collection
);
