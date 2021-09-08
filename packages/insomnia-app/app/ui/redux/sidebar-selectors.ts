import { createSelector } from 'reselect';

import { fuzzyMatchAll } from '../../common/misc';
import type { BaseModel } from '../../models';
import { GrpcRequest, isGrpcRequest } from '../../models/grpc-request';
import { isRequest, Request } from '../../models/request';
import { isRequestGroup, RequestGroup } from '../../models/request-group';
import {
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectCollapsedRequestGroups,
  selectEntitiesChildrenMap,
  selectPinnedRequests,
} from './selectors';

type SidebarModel = Request | GrpcRequest | RequestGroup;

export const shouldShowInSidebar = (model: BaseModel): boolean =>
  isRequest(model) || isGrpcRequest(model) || isRequestGroup(model);

export const shouldIgnoreChildrenOf = (model: SidebarModel): boolean =>
  isRequest(model) || isGrpcRequest(model);

export const sortByMetaKeyOrId = (a: SidebarModel, b: SidebarModel): number => {
  if (a.metaSortKey === b.metaSortKey) {
    return a._id > b._id ? -1 : 1; // ascending
  } else {
    return a.metaSortKey < b.metaSortKey ? -1 : 1; // descending
  }
};

interface Child {
  doc: SidebarModel;
  hidden: boolean;
  collapsed: boolean;
  pinned: boolean;
  children: Child[];
}

export interface SidebarChildren {
  all: Child[];
  pinned: Child[];
}

export const selectSidebarChildren = createSelector(
  selectCollapsedRequestGroups,
  selectPinnedRequests,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectEntitiesChildrenMap,
  (collapsed, pinned, activeWorkspace, activeWorkspaceMeta, childrenMap): SidebarChildren => {
    if (!activeWorkspace) {
      return { all: [], pinned: [] };
    }

    const sidebarFilter = activeWorkspaceMeta ? activeWorkspaceMeta.sidebarFilter : '';

    function next(parentId: string, pinnedChildren: Child[]) {
      const children: SidebarModel[] = (childrenMap[parentId] || [])
        .filter(shouldShowInSidebar)
        .sort(sortByMetaKeyOrId);

      if (children.length > 0) {
        return children.map(c => {
          const child: Child = {
            doc: c,
            hidden: false,
            collapsed: !!collapsed[c._id],
            pinned: !!pinned[c._id],
            children: [],
          };

          if (child.pinned) {
            pinnedChildren.push(child);
          }

          // Don't add children of requests
          child.children = shouldIgnoreChildrenOf(c) ? [] : next(c._id, pinnedChildren);
          return child;
        });
      } else {
        return [];
      }
    }

    function matchChildren(children: Child[], parentNames: string[] = []) {
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
        const method = isGrpcRequest(child.doc) ? 'gRPC' : isRequest(child.doc) ? child.doc.method : '';
        const match = fuzzyMatchAll(sidebarFilter, [name, method, ...parentNames], {
          splitSpace: true,
        });
        // Update hidden state depending on whether it matched
        const matched = hasMatchedChildren || match;
        child.hidden = !matched;
      }

      return children;
    }

    const pinnedChildren: Child[] = [];
    const childrenTree = next(activeWorkspace._id, pinnedChildren);
    const matchedChildren = matchChildren(childrenTree);

    return {
      pinned: pinnedChildren,
      all: matchedChildren,
    };
  },
);
