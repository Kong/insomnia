
import { database } from '../common/database';
import { fuzzyMatchAll } from '../common/misc';
import * as models from '../models';
import { GrpcRequest } from '../models/grpc-request';
import { GrpcRequestMeta } from '../models/grpc-request-meta';
import { Request } from '../models/request';
import { isRequestGroup, RequestGroup } from '../models/request-group';
import { RequestGroupMeta } from '../models/request-group-meta';
import { RequestMeta } from '../models/request-meta';
import { WebSocketRequest } from '../models/websocket-request';
import { Child } from '../ui/routes/workspace';

export const prepareSidebarEntities = async ({ workspaceId, filter, sortFunction }) => {
  // first recursion to get all the folders ids in order to use nedb search by an array
  const flattenFoldersIntoList = async (id: string): Promise<string[]> => {
    const parentIds: string[] = [id];
    const folderIds = (await models.requestGroup.findByParentId(id)).map(r => r._id);
    if (folderIds.length) {
      await Promise.all(folderIds.map(async folderIds => parentIds.push(...(await flattenFoldersIntoList(folderIds)))));
    }
    return parentIds;
  };
  const listOfParentIds = await flattenFoldersIntoList(workspaceId);

  const reqs = await database.find(models.request.type, { parentId: { $in: listOfParentIds } });
  const reqGroups = await database.find(models.requestGroup.type, { parentId: { $in: listOfParentIds } });
  const grpcReqs = await database.find(models.grpcRequest.type, { parentId: { $in: listOfParentIds } }) as GrpcRequest[];
  const wsReqs = await database.find(models.webSocketRequest.type, { parentId: { $in: listOfParentIds } });
  const allRequests = [...reqs, ...reqGroups, ...grpcReqs, ...wsReqs] as (Request | RequestGroup | GrpcRequest | WebSocketRequest)[];

  const requestMetas = await database.find(models.requestMeta.type, { parentId: { $in: reqs.map(r => r._id) } });
  const grpcRequestMetas = await database.find(models.grpcRequestMeta.type, { parentId: { $in: grpcReqs.map(r => r._id) } });
  const grpcAndRequestMetas = [...requestMetas, ...grpcRequestMetas] as (RequestMeta | GrpcRequestMeta)[];
  const requestGroupMetas = await database.find(models.requestGroupMeta.type, { parentId: { $in: listOfParentIds } }) as RequestGroupMeta[];

  // second recursion to build the tree
  const getCollectionTree = async ({
    parentId,
    level,
    parentIsCollapsed,
    ancestors,
  }: {
    parentId: string; level: number; parentIsCollapsed: boolean; ancestors: string[];
  }): Promise<Child[]> => {
    const levelReqs = allRequests.filter(r => r.parentId === parentId);

    const childrenWithChildren: Child[] = await Promise.all(levelReqs
      .sort(sortFunction)
      .map(async (doc): Promise<Child> => {
        const isMatched = (filter: string): boolean =>
          Boolean(fuzzyMatchAll(
            filter,
            [
              doc.name,
              doc.description,
              ...(isRequestGroup(doc) ? [] : [doc.url]),
            ],
            { splitSpace: true, loose: true }
          )?.indexes);
        const shouldHide = Boolean(filter && !isMatched(filter));
        const hidden = parentIsCollapsed || shouldHide;

        const pinned =
          !isRequestGroup(doc) && grpcAndRequestMetas.find(m => m.parentId === doc._id)?.pinned || false;
        const collapsed = filter
          ? false
          : parentIsCollapsed ||
          (isRequestGroup(doc) &&
            requestGroupMetas.find(m => m.parentId === doc._id)?.collapsed) ||
          false;

        const docAncestors = [...ancestors, parentId];

        return {
          doc,
          pinned,
          collapsed,
          hidden,
          level,
          ancestors: docAncestors,
          children: await getCollectionTree({
            parentId: doc._id,
            level: level + 1,
            parentIsCollapsed: collapsed,
            ancestors: docAncestors,
          }),
        };
      }),
    );

    return childrenWithChildren;
  };
  console.time('getCollectionTree');
  const requestTree = await getCollectionTree({
    parentId: workspaceId,
    level: 0,
    parentIsCollapsed: false,
    ancestors: [],
  });
  console.timeEnd('getCollectionTree');
  return { requestTree, allRequests, grpcReqs };
};
