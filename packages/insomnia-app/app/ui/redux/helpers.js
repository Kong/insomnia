// @flow
import * as models from '../../models';
import type { BaseModel } from '../../models';
import type { Request } from '../../models/request';
import type { GrpcRequest } from '../../models/grpc-request';
import type { RequestGroup } from '../../models/request-group';

export const shouldShowInSidebar = ({ type }: BaseModel): boolean =>
  type === models.request.type ||
  type === models.grpcRequest.type ||
  type === models.requestGroup.type;

type SidebarModels = Request | GrpcRequest | RequestGroup;

export const shouldIgnoreChildrenOf = ({ type }: SidebarModels): boolean =>
  type === models.request.type || type === models.grpcRequest.type;

export const sortByMetaKeyOrId = (a: SidebarModels, b: SidebarModels): number => {
  if (a.metaSortKey === b.metaSortKey) {
    return a._id > b._id ? -1 : 1; // ascending
  } else {
    return a.metaSortKey < b.metaSortKey ? -1 : 1; // descending
  }
};
