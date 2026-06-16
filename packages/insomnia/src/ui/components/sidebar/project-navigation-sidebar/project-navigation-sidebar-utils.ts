import type { BaseModel } from 'insomnia-data';
import { models } from 'insomnia-data';

import { fuzzyMatchAll } from '~/common/misc';
import { sortMethodMap } from '~/common/sorting';
import type { Child } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import type { CollectionChildDoc, CollectionWorkspaceChildren } from '~/ui/hooks/data/workspace-children';

export interface SlimRequestDoc extends BaseModel {
  type: 'Request' | 'GrpcRequest' | 'WebSocketRequest' | 'SocketIORequest' | 'RequestGroup';
  metaSortKey: number;
  url: string;
  method?: string;
  description?: string;
}

// TODO SLIM THE REQUEST DOCS TO ONLY WHAT WE NEED FOR THE SIDEBAR TO IMPROVE PERFORMANCE
// const toSlimDoc = (r: AllRequestDoc): SlimRequestDoc => ({
//   _id: r._id,
//   parentId: r.parentId,
//   type: r.type as SlimRequestDoc['type'],
//   isPrivate: r.isPrivate,
//   metaSortKey: r.metaSortKey,
//   name: r.name,
//   url: 'url' in r ? r.url : '',
//   method: 'method' in r ? r.method : undefined,
//   description: r.description,
//   modified: r.modified,
//   created: r.created,
// });

export function flattenCollectionChildren(
  workspaceId: string,
  parentIsCollapsed: boolean,
  collectionWorkspaceChildren: CollectionWorkspaceChildren,
  sortOrder: keyof typeof sortMethodMap = 'type-manual',
): Child[] {
  const { isRequestGroup } = models.requestGroup;
  const allRequests = collectionWorkspaceChildren.children.requestsAndGroups;
  const { allRequestMetas, requestGroupMetas } = collectionWorkspaceChildren.childrenMetas;

  const collection: Child[] = [];

  // map of parentId to its direct children requests and request groups
  const requestsByParentId = new Map<string, CollectionChildDoc[]>();

  for (const req of allRequests) {
    const allRequestsByParentId = requestsByParentId.get(req.parentId);
    if (allRequestsByParentId) {
      allRequestsByParentId.push(req);
    } else {
      requestsByParentId.set(req.parentId, [req]);
    }
  }
  const sortFunction = sortMethodMap[sortOrder];
  const rootRequests = (requestsByParentId.get(workspaceId) || []).sort(sortFunction);
  const stack: { doc: CollectionChildDoc; level: number; parentIsCollapsed: boolean; ancestors: string[] }[] = [
    ...rootRequests,
  ]
    .reverse()
    .map(doc => ({
      level: 0,
      parentIsCollapsed: parentIsCollapsed,
      ancestors: [],
      doc: doc,
    }));

  while (stack.length) {
    const { doc, level, parentIsCollapsed, ancestors } = stack.pop()!;
    const hidden = parentIsCollapsed;
    const pinned = (!isRequestGroup(doc) && allRequestMetas.find(m => m.parentId === doc._id)?.pinned) || false;
    const collapsed =
      parentIsCollapsed ||
      (isRequestGroup(doc) && (requestGroupMetas.find(m => m.parentId === doc._id)?.collapsed ?? false)) ||
      false;

    collection.push({ doc, pinned, collapsed, hidden, level, ancestors, children: [] });

    // if it's a request group, add its children to the stack
    if (isRequestGroup(doc)) {
      const childDocs = (requestsByParentId.get(doc._id) || []).sort(sortFunction);
      const childAncestors = [...ancestors, doc._id];
      for (let i = childDocs.length - 1; i >= 0; i--) {
        stack.push({ doc: childDocs[i], level: level + 1, parentIsCollapsed: collapsed, ancestors: childAncestors });
      }
    }
  }

  // Assign children for request groups
  const nodeByDocId = new Map(collection.map(n => [n.doc._id, n]));
  for (const node of collection) {
    if (isRequestGroup(node.doc)) {
      node.children = (requestsByParentId.get(node.doc._id) || [])
        .map(doc => nodeByDocId.get(doc._id))
        .filter((n): n is Child => !!n);
    }
  }

  return collection;
}

export function filterCollection(collection: Child[], filter: string): Child[] {
  if (!filter) return collection;
  const filtered = collection.map(node => ({
    ...node,
    hidden: !fuzzyMatchAll(
      filter,
      [
        node.doc.name,
        (node.doc as { description?: string }).description ?? '',
        ...(!models.requestGroup.isRequestGroup(node.doc) ? [(node.doc as { url?: string }).url ?? ''] : []),
      ],
      { splitSpace: false, loose: true },
    )?.indexes,
    collapsed: false,
  }));
  const nodeById = new Map(filtered.map(item => [item.doc._id, item]));

  filtered.forEach(node => {
    if (!node.hidden) {
      (node.ancestors || []).forEach(ancestorId => {
        const ancestor = nodeById.get(ancestorId);
        if (ancestor) {
          ancestor.hidden = false;
        }
      });
    }
  });
  return filtered;
}

// Common tailwind classes
export const ROW_CLASS =
  'relative flex h-(--line-height-xs) w-full items-center gap-1 overflow-hidden text-[rgba(var(--color-font-rgb),0.8)] outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-aria-selected:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font) pr-4';

export const ACTIVE_BORDER_CLASS =
  'absolute top-0 left-0 h-full w-0.5 bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)';
export const GUIDE_LINE_CSS = 'absolute inset-y-0 w-px bg-transparent transition-colors';

// for toggle button
export const TOGGLE_BTN_CLASS =
  'flex shrink-0 items-center justify-center text-base text-[rgba(var(--color-font-rgb),0.8)] hover:text-(--color-font) focus:outline-none w-4 h-4';
export const ICON_CLASS = 'h-3 w-3 shrink-0';

export const INDENT_PX = 16;
