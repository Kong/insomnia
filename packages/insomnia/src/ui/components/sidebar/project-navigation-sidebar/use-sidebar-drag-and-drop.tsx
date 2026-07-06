import type { Virtualizer } from '@tanstack/react-virtual';
import { models, type WorkspaceScope } from 'insomnia-data';
import { useCallback, useMemo, useRef } from 'react';
import type { DragAndDropHooks, ItemDropTarget } from 'react-aria-components';
import { DropIndicator, useDragAndDrop } from 'react-aria-components';

import { useDebugReorderActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.reorder';

import type { CollectionChildFlatItem, EmptyNodeFlatItem, FlatItem } from './types';

const allowDragKinds: FlatItem['kind'][] = ['workspace', 'collectionChild'];
const emptyNodeKinds: FlatItem['kind'][] = ['emptyFolder', 'emptyProject', 'emptyCollection'];
const allowDropKinds: FlatItem['kind'][] = ['workspace', 'collectionChild', 'project', ...emptyNodeKinds];
type AllowDragItem = Extract<FlatItem, { kind: 'workspace' | 'collectionChild' }>;
type AllowDropTarget = Extract<
  FlatItem,
  { kind: 'workspace' | 'collectionChild' | 'project' | 'emptyFolder' | 'emptyProject' | 'emptyCollection' }
>;
// Whitelist workspace scopes that are allowed to be moved across projects.
const allowCrossProjectDropWorkspaceScope: WorkspaceScope[] = [models.workspace.WorkspaceScopeKeys.collection];

function isAllowDragItem(item: FlatItem): item is AllowDragItem {
  return allowDragKinds.includes(item.kind);
}

function isAllowDropTarget(item: FlatItem): item is AllowDropTarget {
  return allowDropKinds.includes(item.kind);
}

function isEmptyNode(item: FlatItem): item is EmptyNodeFlatItem {
  return emptyNodeKinds.includes(item.kind);
}

function canDrop(
  dragItem: FlatItem,
  dropItem: FlatItem,
  { dropPosition }: ItemDropTarget,
  dropPrevItem: FlatItem | null,
  dropNextItem: FlatItem | null,
  expandedProjectAndWorkspaceIds?: string[],
) {
  const realDropItem = dropPosition === 'before' ? dropPrevItem : dropItem;
  // The item following realDropItem in the list
  const itemAfterRealDrop = dropPosition === 'before' ? dropItem : dropNextItem;
  // drag and drop items are same.
  if (
    !realDropItem ||
    dragItem.doc._id === dropItem.doc._id ||
    dragItem.doc._id === realDropItem.doc._id ||
    !isAllowDropTarget(realDropItem)
  ) {
    return false;
  }

  if (!isAllowDragItem(dragItem)) {
    return false;
  }

  const dropIsProject = realDropItem.kind === 'project';
  const dragInCloud = models.project.isRemoteProject(dragItem.project);
  if (dragItem.kind === 'workspace') {
    const dragWorkspaceScope = dragItem.doc.scope;
    if (realDropItem) {
      if (realDropItem.kind === 'project') {
        const dropToAnotherProject = dragItem.project._id !== realDropItem.doc._id;
        // only allow moving collection and design workspace into another project
        if (dropToAnotherProject && !allowCrossProjectDropWorkspaceScope.includes(dragWorkspaceScope)) {
          return false;
        }
        if (dropToAnotherProject && (dragInCloud || models.project.isRemoteProject(realDropItem.doc))) {
          // can not move cloud sync workspace into another project, and can not move any workspace into cloud sync project
          return false;
        }
        return true;
      }
      const isWorkspaceMoveAllowed = () => {
        if (dragInCloud) {
          // cloud sync workspaces can only move within same project and cannot move into other projects
          return (
            dragItem.project._id === realDropItem.project._id && models.project.isRemoteProject(realDropItem.project)
          );
        }
        const dropToAnotherProject = dragItem.project._id !== realDropItem.project._id;
        // only allow moving collection and design workspace into another project
        if (dropToAnotherProject && !allowCrossProjectDropWorkspaceScope.includes(dragWorkspaceScope)) {
          return false;
        }
        // local/git workspace can move within same project or move into other local/git project
        return !models.project.isRemoteProject(realDropItem.project);
      };
      if (realDropItem.kind === 'workspace') {
        if (realDropItem.doc.scope === 'collection' && expandedProjectAndWorkspaceIds?.includes(realDropItem.doc._id)) {
          // Can not drop on expanded collection
          return false;
        }
        return isWorkspaceMoveAllowed();
      }
      if (realDropItem.kind === 'collectionChild') {
        // Drop after a collection child who is the last element of its parent workspace
        const isLastChildOfWorkspace =
          itemAfterRealDrop == null ||
          itemAfterRealDrop.kind !== 'collectionChild' ||
          itemAfterRealDrop.workspace._id !== realDropItem.workspace._id;
        if (!isLastChildOfWorkspace) {
          return false;
        }
        return isWorkspaceMoveAllowed();
      }
    }

    return false;
  }

  // move other things into project is not allowed
  if (dropIsProject) {
    return false;
  }

  // move request and request group into collection
  if (
    realDropItem.kind === 'workspace' &&
    models.workspace.isCollection(realDropItem.doc) &&
    (models.requestGroup.isRequestGroup(dragItem.doc) || models.request.isRequest(dragItem.doc))
  ) {
    // not same collection and none are in cloud
    const dropInCloud = models.project.isRemoteProject(realDropItem.project);
    return !dragInCloud && !dropInCloud;
  }

  // move other things into workspace is not allowed, or move after empty node is not allowed
  if (realDropItem.kind === 'workspace' || isEmptyNode(realDropItem)) {
    return false;
  }

  return !(models.requestGroup.isRequestGroup(dragItem.doc) && realDropItem.ancestors?.includes(dragItem.doc._id));
}

interface UseSidebarDragAndDropOptions {
  flatItems: FlatItem[];
  organizationId: string;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  onWorkspaceReorder?: (
    sourceProjectId: string,
    targetProjectId: string,
    draggedId: string,
    // null means drop to the first position in the target project
    targetWorkspaceId: string | null,
    dropPosition: 'before' | 'after',
  ) => void;
  expandedProjectAndWorkspaceIds?: string[];
}

export const useSidebarDragAndDrop = ({
  flatItems,
  organizationId,
  virtualizer,
  onWorkspaceReorder,
  expandedProjectAndWorkspaceIds,
}: UseSidebarDragAndDropOptions): DragAndDropHooks => {
  const reorderFetcher = useDebugReorderActionFetcher();

  const flatItemsById = useMemo(() => {
    const visibles = flatItems.filter(item => !item.hidden);
    // keep previous item for "move into collection/project" logic, also previous and next item
    return new Map(
      visibles.map((item, index) => [item.doc._id, [item, visibles[index - 1], visibles[index + 1]]] as const),
    );
  }, [flatItems]);
  const draggingCollectionItemIdRef = useRef<string | null>(null);

  const getCollectionItemByKey = useCallback(
    (key: string | number | symbol | null | undefined) => {
      if (key == null) {
        return null;
      }

      return flatItemsById.get(key.toString())?.[0] || null;
    },
    [flatItemsById],
  );

  const collectionDragAndDrop = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onDragStart(event) {
      const [draggedKey] = event.keys;
      draggingCollectionItemIdRef.current = draggedKey?.toString() || null;
    },
    onDragEnd() {
      draggingCollectionItemIdRef.current = null;
    },
    getDropOperation(target, _types) {
      if (target.type !== 'item' || target.dropPosition === 'on') {
        return 'cancel';
      }
      return 'move';
    },
    onMove(event) {
      const { type, dropPosition: _dropPosition, key } = event.target;
      if (type !== 'item') {
        return;
      }
      let dropPosition = _dropPosition;
      const isBefore = dropPosition === 'before';
      const droppedKey = key.toString();

      const [draggedKey] = event.keys;
      const draggedItem = getCollectionItemByKey(draggedKey) as AllowDragItem | null;
      const targetItem = getCollectionItemByKey(droppedKey) as AllowDropTarget | null;
      const realTargetItem = isBefore ? flatItemsById.get(droppedKey)?.[1] : targetItem;
      if (
        !draggedItem ||
        !targetItem ||
        !canDrop(
          draggedItem,
          targetItem,
          event.target,
          flatItemsById.get(droppedKey)?.[1] || null,
          flatItemsById.get(droppedKey)?.[2] || null,
          expandedProjectAndWorkspaceIds,
        )
      ) {
        return;
      }

      // move workspace to another project or reorder within same project
      if (draggedItem.kind === 'workspace') {
        if (_dropPosition === 'on') {
          return;
        }
        // Dropping after the last child of a collection
        if (realTargetItem?.kind === 'collectionChild') {
          const targetProjectId = realTargetItem.project._id;
          const isDropToAnotherProject = targetProjectId !== draggedItem.project._id;
          if (isDropToAnotherProject) {
            reorderFetcher.submit({
              organizationId,
              projectId: draggedItem.project._id,
              workspaceId: draggedItem.doc._id,
              params: {
                type: 'move-workspace',
                targetId: targetProjectId,
                id: draggedItem.doc._id,
              },
            });
          }
          onWorkspaceReorder?.(
            draggedItem.project._id,
            targetProjectId,
            draggedItem.doc._id,
            realTargetItem.workspace._id,
            'after',
          );
          return;
        }
        const isDropToAnotherProject =
          (realTargetItem?.kind === 'project' && realTargetItem.doc._id !== draggedItem.project._id) ||
          (realTargetItem?.kind === 'workspace' && realTargetItem.project._id !== draggedItem.project._id);
        if (isDropToAnotherProject) {
          // Move workspace to another project
          reorderFetcher.submit({
            organizationId,
            projectId: draggedItem.project._id,
            workspaceId: draggedItem.doc._id,
            params: {
              type: 'move-workspace',
              targetId: realTargetItem?.kind === 'workspace' ? realTargetItem.project._id : realTargetItem!.doc._id,
              id: draggedItem.doc._id,
            },
          });
          const targetProjectId =
            realTargetItem?.kind === 'project' ? realTargetItem.doc._id : realTargetItem!.project._id;
          if (realTargetItem.kind === 'project') {
            onWorkspaceReorder?.(draggedItem.project._id, targetProjectId, draggedItem.doc._id, null, 'before');
          } else if (targetItem) {
            onWorkspaceReorder?.(
              draggedItem.project._id,
              targetProjectId,
              draggedItem.doc._id,
              targetItem.doc._id,
              _dropPosition,
            );
          }
        } else {
          if (realTargetItem?.kind === 'project') {
            onWorkspaceReorder?.(draggedItem.project._id, draggedItem.project._id, draggedItem.doc._id, null, 'before');
          } else if (realTargetItem?.kind === 'workspace') {
            onWorkspaceReorder?.(
              draggedItem.project._id,
              draggedItem.project._id,
              draggedItem.doc._id,
              targetItem.doc._id,
              _dropPosition,
            );
          }
        }
        return;
      }

      // move request or request group into collection
      if (realTargetItem?.kind === 'workspace' && models.workspace.isCollection(realTargetItem!.doc)) {
        const siblingItem = flatItems.find(
          (item): item is CollectionChildFlatItem =>
            item.kind === 'collectionChild' && item.doc.parentId === realTargetItem!.doc._id,
        );
        reorderFetcher.submit({
          organizationId,
          projectId: draggedItem.project._id,
          workspaceId: draggedItem.workspace._id,
          params: {
            targetId: realTargetItem!.doc._id,
            id: draggedItem.doc._id,
            dropPosition: 'after', // collection only accepts move into, so treat all drops as "after"
            metaSortKey: siblingItem?.doc.metaSortKey != null ? siblingItem.doc.metaSortKey - 100 : -1 * Date.now(),
          },
        });
        return;
      }

      const id = draggedItem.doc._id;
      let targetId = targetItem.doc._id;
      const targetIsEmptyNode = isEmptyNode(targetItem);
      const workspaceCollectionItems = flatItems.filter(
        (item): item is CollectionChildFlatItem =>
          item.kind === 'collectionChild' && item.workspace._id === draggedItem.workspace._id,
      );
      let metaSortKey = 0;
      const isMovingItemInsideFolder =
        !targetIsEmptyNode && models.requestGroup.isRequestGroup(targetItem.doc) && dropPosition === 'after';

      const isMovingOnEmptyNode =
        realTargetItem &&
        'type' in realTargetItem.doc &&
        models.requestGroup.isRequestGroup(realTargetItem.doc) &&
        targetIsEmptyNode;

      if (isMovingItemInsideFolder) {
        // The reorder route interprets "after folder" as moving into that folder.
        const children = workspaceCollectionItems.filter(item => item.doc.parentId === targetId);
        metaSortKey = children.length > 0 ? children[0].doc.metaSortKey - 100 : -1 * Date.now();
      } else if (isMovingOnEmptyNode) {
        targetId = realTargetItem.doc._id;
        dropPosition = 'after';
        metaSortKey = -1 * Date.now();
      } else {
        // move before or after another request in same or different collection
        const siblingItems = workspaceCollectionItems.filter(
          item => 'parentId' in targetItem.doc && item.doc.parentId === targetItem.doc.parentId,
        );
        const targetIndex = siblingItems.findIndex(item => item.doc._id === targetId);

        if ('metaSortKey' in targetItem.doc && targetItem.doc.metaSortKey != null) {
          if (dropPosition === 'after') {
            const afterItem = siblingItems[targetIndex + 1];
            metaSortKey = afterItem
              ? targetItem.doc.metaSortKey - (targetItem.doc.metaSortKey - afterItem.doc.metaSortKey) / 2
              : targetItem.doc.metaSortKey + 100;
          } else {
            const beforeItem = siblingItems[targetIndex - 1];
            metaSortKey = beforeItem
              ? targetItem.doc.metaSortKey - (targetItem.doc.metaSortKey - beforeItem.doc.metaSortKey) / 2
              : targetItem.doc.metaSortKey - 100;
          }
        }
      }

      if (!metaSortKey) {
        return;
      }

      reorderFetcher.submit({
        organizationId,
        projectId: draggedItem.project._id,
        workspaceId: draggedItem.workspace._id,
        params: {
          targetId,
          id,
          dropPosition,
          metaSortKey,
        },
      });
    },
    renderDropIndicator(target) {
      if (target.type === 'item') {
        const item = virtualizer.getVirtualItems().find(virtualItem => virtualItem.key === target.key);
        if (item) {
          const draggedItem = getCollectionItemByKey(draggingCollectionItemIdRef.current);
          const targetItem = getCollectionItemByKey(target.key);
          if (
            draggedItem == null ||
            targetItem == null ||
            !canDrop(
              draggedItem as FlatItem,
              targetItem as FlatItem,
              target,
              flatItemsById.get(target.key.toString())?.[1] || null,
              flatItemsById.get(target.key.toString())?.[2] || null,
              expandedProjectAndWorkspaceIds,
            )
          ) {
            return (
              <DropIndicator
                target={target}
                className="absolute top-0 left-0 z-10 w-full outline-1 outline-(--color-danger) outline-solid"
                style={{
                  transform: `translateY(${target.dropPosition === 'before' ? item.start : item.end}px)`,
                }}
              />
            );
          }
          return (
            <DropIndicator
              target={target}
              className="absolute top-0 left-0 z-10 w-full outline-1 outline-(--color-surprise) outline-solid"
              style={{
                transform: `translateY(${target.dropPosition === 'before' ? item.start : item.end}px)`,
              }}
            />
          );
        }
      }

      return (
        <DropIndicator
          target={target}
          className="absolute top-0 left-0 outline-1 outline-(--color-surprise) outline-solid"
        />
      );
    },
  });

  // useDragAndDrop gives us collection-wide hooks. Wrap them once so project/workspace
  // rows stay non-draggable while collection rows keep the original drag behavior.
  return useMemo(() => {
    const originalUseDraggableItem = collectionDragAndDrop.dragAndDropHooks.useDraggableItem;
    if (!originalUseDraggableItem) {
      return collectionDragAndDrop.dragAndDropHooks;
    }

    return {
      ...collectionDragAndDrop.dragAndDropHooks,
      useDraggableItem(props, state) {
        const draggableItem = originalUseDraggableItem(props, state);
        const flatItem = flatItemsById.get(props.key.toString())?.[0];
        const isDraggable = ['collectionChild', 'workspace'].includes(flatItem?.kind || '');

        if (!isDraggable) {
          return {
            ...draggableItem,
            dragProps: {
              ...draggableItem.dragProps,
              draggable: 'false',
            },
            dragButtonProps: {
              ...draggableItem.dragButtonProps,
              isDisabled: true,
            },
          };
        }

        return draggableItem;
      },
    };
  }, [collectionDragAndDrop.dragAndDropHooks, flatItemsById]);
};
