// @flow
import type { BaseModel } from '../../models';
import type { Request } from '../../models/request';
import type { GrpcRequest } from '../../models/grpc-request';
import type { RequestGroup } from '../../models/request-group';
import { createSelector } from 'reselect';
import { fuzzyMatchAll } from '../../common/misc';
import {
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectCollapsedRequestGroups,
  selectEntitiesChildrenMap,
  selectPinnedRequests,
} from './selectors';
import { isGrpcRequest, isRequest, isRequestGroup } from '../../models/helpers/is-model';

type SidebarModels = Request | GrpcRequest | RequestGroup;

export const shouldShowInSidebar = (model: BaseModel): boolean =>
  isRequest(model) || isGrpcRequest(model) || isRequestGroup(model);

export const shouldIgnoreChildrenOf = (model: SidebarModels): boolean =>
  isRequest(model) || isGrpcRequest(model);

export const sortByMetaKeyOrId = (a: SidebarModels, b: SidebarModels): number => {
  if (a.metaSortKey === b.metaSortKey) {
    return a._id > b._id ? -1 : 1; // ascending
  } else {
    return a.metaSortKey < b.metaSortKey ? -1 : 1; // descending
  }
};

export const selectSidebarChildren = createSelector(
  selectCollapsedRequestGroups,
  selectPinnedRequests,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectEntitiesChildrenMap,
  (collapsed, pinned, activeWorkspace, activeWorkspaceMeta, childrenMap) => {
    const sidebarFilter = activeWorkspaceMeta ? activeWorkspaceMeta.sidebarFilter : '';

    function next(parentId, pinnedChildren) {
      const children: Array<SidebarModels> = (childrenMap[parentId] || [])
        .filter(shouldShowInSidebar)
        .sort(sortByMetaKeyOrId);

      if (children.length > 0) {
        return children.map(c => {
          const child = {
            doc: c,
            hidden: false,
            collapsed: !!collapsed[c._id],
            pinned: !!pinned[c._id],
          };

          if (child.pinned) {
            pinnedChildren.push(child);
          }

          // Don't add children of requests
          child.children = shouldIgnoreChildrenOf(c) ? [] : next(c._id, pinnedChildren);

          return child;
        });
      } else {
        return children;
      }
    }

    function matchChildren(children, parentNames = []) {
      // Bail early if no filter defined
      if (!sidebarFilter) {
        return children;
      }

      for (const child of children) {
        // Gather all parents so we can match them too
        matchChildren(child.children, [...parentNames, child.doc.name]);

        const hasMatchedChildren = child.children.find(c => c.hidden === false);

        // Try to match request attributes
        const name = child.doc.name;
        const method = isGrpcRequest(child.doc) ? 'gRPC' : child.doc.method;

        const match = fuzzyMatchAll(sidebarFilter, [name, method, ...parentNames], {
          splitSpace: true,
        });

        // Update hidden state depending on whether it matched
        const matched = hasMatchedChildren || match;
        child.hidden = !matched;
      }

      return children;
    }

    const pinnedChildren = [];
    const childrenTree = next(activeWorkspace._id, pinnedChildren);
    const matchedChildren = matchChildren(childrenTree);

    return { pinned: pinnedChildren, all: matchedChildren };
  },
);
