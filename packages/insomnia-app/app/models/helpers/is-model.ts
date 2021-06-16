import {
  BaseModel,
  request,
  requestGroup,
  protoFile,
  protoDirectory,
  workspace,
} from '../index';

import type { CollectionWorkspace, DesignWorkspace, Workspace } from '../workspace';
import { WorkspaceScopeKeys } from '../../models/workspace';
import { ProtoDirectory } from '../proto-directory';
import { ProtoFile } from '../proto-file';
import { RequestGroup } from '../request-group';
import { Request } from '../request';

// TODO: Invalid until we can ensure all requests are prefixed by the id correctly INS-341
// export const isRequestId = (id: string) => id.startsWith(`${request.prefix}_`);

export const isRequest = (obj: Pick<BaseModel, 'type'>): obj is Request => (
  obj.type === request.type
);

export const isRequestGroup = (obj: Pick<BaseModel, 'type'>): obj is RequestGroup => (
  obj.type === requestGroup.type
);

export const isProtoFile = (obj: Pick<BaseModel, 'type'>): obj is ProtoFile => (
  obj.type === protoFile.type
);

export const isProtoDirectory = (obj: Pick<BaseModel, 'type'>): obj is ProtoDirectory => (
  obj.type === protoDirectory.type
);

export const isWorkspace = (obj: Pick<BaseModel, 'type'>): obj is Workspace => (
  obj.type === workspace.type
);

export const isDesign = (obj: Pick<Workspace, 'scope'>): obj is DesignWorkspace => (
  obj.scope === WorkspaceScopeKeys.design
);

export const isCollection = (obj: Pick<Workspace, 'scope'>): obj is CollectionWorkspace => (
  obj.scope === WorkspaceScopeKeys.collection
);
