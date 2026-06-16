import type { CollectionChildDoc, CollectionWorkspaceChildren } from 'insomnia-data';
import { models } from 'insomnia-data';

import { fuzzyMatchAll } from '~/common/misc';
import { sortMethodMap } from '~/common/sorting';
import type { Child } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';

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
