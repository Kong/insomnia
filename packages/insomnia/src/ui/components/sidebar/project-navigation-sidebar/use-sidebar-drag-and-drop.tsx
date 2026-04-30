import type { Virtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef } from 'react';
import type { DragAndDropHooks, ItemDropTarget } from 'react-aria-components';
import { DropIndicator, useDragAndDrop } from 'react-aria-components';

import { models } from '~/insomnia-data';
import { useDebugReorderActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.reorder';

import type { FlatItem } from './types';

function canDrop(
  dragItem: FlatItem,
  dropItem: FlatItem,
  { dropPosition }: ItemDropTarget,
  dropPrevItem: FlatItem | null,
) {
  const realDropItem = dropPosition === 'before' ? dropPrevItem : dropItem;
  // drag and drop items are same.
  if (!realDropItem || dragItem.doc._id === dropItem.doc._id || dragItem.doc._id === realDropItem.doc._id) {
    return false;
  }

  if (dragItem.kind === 'unsyncedWorkspace' || realDropItem.kind === 'unsyncedWorkspace') {
    return false;
  }

  if (dragItem.kind === 'project') {
    return false;
  }

  const dropIsProject = realDropItem.kind === 'project';
  const dragInCloud = models.project.isRemoteProject(dragItem.project);

  // workspace -> project: cannot involve cloud project, and cannot move into same project
  if (dragItem.kind === 'workspace') {
    if (realDropItem && realDropItem.kind === 'project') {
      return (
        dragItem.project._id !== realDropItem.doc._id &&
        !dragInCloud &&
        !models.project.isRemoteProject(realDropItem.doc)
      );
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

  // move other things into workspace is not allowed
  if (realDropItem.kind === 'workspace') {
    return false;
  }

  return !(models.requestGroup.isRequestGroup(dragItem.doc) && realDropItem.ancestors?.includes(dragItem.doc._id));
}

interface UseSidebarDragAndDropOptions {
  flatItems: FlatItem[];
  organizationId: string;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}

export const useSidebarDragAndDrop = ({
  flatItems,
  organizationId,
  virtualizer,
}: UseSidebarDragAndDropOptions): DragAndDropHooks => {
  const reorderFetcher = useDebugReorderActionFetcher();
  const flatItemsById = useMemo(() => {
    const visibles = flatItems.filter(item => !item.hidden);
    return new Map(visibles.map((item, index) => [item.doc._id, [item, visibles[index - 1]]] as const)); // keep previous item for "move into collection/project" logic
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
      const { type, dropPosition, key } = event.target;
      if (type !== 'item') {
        return;
      }
      const isBefore = dropPosition === 'before';
      const dropedKey = key.toString();

      const [draggedKey] = event.keys;
      const draggedItem = getCollectionItemByKey(draggedKey);
      const targetItem = getCollectionItemByKey(dropedKey);
      const realTargetItem = isBefore ? flatItemsById.get(dropedKey)?.[1] : targetItem;
      if (
        !draggedItem ||
        !targetItem ||
        !canDrop(draggedItem, targetItem, event.target, flatItemsById.get(dropedKey)?.[1] || null)
      ) {
        return;
      }

      if (draggedItem.kind === 'project' || draggedItem.kind === 'unsyncedWorkspace') {
        // make type checker happy
        return;
      }

      // move workspace to another project
      if (draggedItem.kind === 'workspace') {
        reorderFetcher.submit({
          organizationId,
          projectId: draggedItem.project._id,
          workspaceId: draggedItem.doc._id,
          params: {
            type: 'move-workspace',
            targetId: realTargetItem!.doc._id,
            id: draggedItem.doc._id,
          },
        });
        return;
      }

      // move request or request group into collection
      if (realTargetItem?.kind === 'workspace' && models.workspace.isCollection(realTargetItem!.doc)) {
        const siblingItem = flatItems.find(item => item.doc.parentId === realTargetItem!.doc._id);
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
      const targetId = targetItem.doc._id;
      const workspaceCollectionItems = flatItems.filter(
        item => 'workspace' in item && item.workspace._id === draggedItem.workspace._id,
      );
      let metaSortKey = 0;
      const isMovingItemInsideFolder =
        models.requestGroup.isRequestGroup(targetItem.doc) && event.target.dropPosition === 'after';
      if (isMovingItemInsideFolder) {
        // The reorder route interprets "after folder" as moving into that folder.
        const children = workspaceCollectionItems.filter(item => item.doc.parentId === targetId);
        metaSortKey = children.length > 0 ? children[0].doc.metaSortKey - 100 : -1 * Date.now();
      } else {
        const siblingItems = workspaceCollectionItems.filter(item => item.doc.parentId === targetItem.doc.parentId);
        const targetIndex = siblingItems.findIndex(item => item.doc._id === targetId);

        if (event.target.dropPosition === 'after') {
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
          dropPosition: event.target.dropPosition,
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
            !canDrop(
              draggedItem as FlatItem,
              targetItem as FlatItem,
              target,
              flatItemsById.get(target.key.toString())?.[1] || null,
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
        const isDraggable =
          models.workspace.isWorkspaceId(props.key.toString()) || flatItemsById.has(props.key.toString());

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
