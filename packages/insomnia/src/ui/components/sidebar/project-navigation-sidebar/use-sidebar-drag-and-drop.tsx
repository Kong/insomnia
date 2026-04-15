import type { Virtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef } from 'react';
import type { DragAndDropHooks } from 'react-aria-components';
import { DropIndicator, useDragAndDrop } from 'react-aria-components';

import { models } from '~/insomnia-data';
import { useDebugReorderActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.reorder';

import type { CollectionChildFlatItem, FlatItem } from './types';

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
  const collectionItems = useMemo(
    () => flatItems.filter((item): item is CollectionChildFlatItem => item.kind === 'collectionChild'),
    [flatItems],
  );
  const collectionItemsById = useMemo(() => {
    return new Map(collectionItems.map(item => [item.doc._id, item]));
  }, [collectionItems]);
  const draggingCollectionItemIdRef = useRef<string | null>(null);

  const getCollectionItemByKey = useCallback(
    (key: string | number | symbol | null | undefined) => {
      if (key == null) {
        return null;
      }

      return collectionItemsById.get(key.toString()) || null;
    },
    [collectionItemsById],
  );

  const canDropCollectionItem = useCallback(
    (draggedItem: CollectionChildFlatItem, targetItem: CollectionChildFlatItem) => {
      if (draggedItem.workspace._id !== targetItem.workspace._id) {
        return false;
      }

      if (draggedItem.doc._id === targetItem.doc._id) {
        return false;
      }

      return !(
        models.requestGroup.isRequestGroup(draggedItem.doc) && targetItem.ancestors?.includes(draggedItem.doc._id)
      );
    },
    [],
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
    getDropOperation(target, _types, allowedOperations) {
      if (target.type !== 'item' || target.dropPosition === 'on') {
        return 'cancel';
      }

      const draggedItem = getCollectionItemByKey(draggingCollectionItemIdRef.current);
      const targetItem = getCollectionItemByKey(target.key);
      if (!draggedItem || !targetItem || !canDropCollectionItem(draggedItem, targetItem)) {
        return 'cancel';
      }

      return allowedOperations.includes('move') ? 'move' : 'cancel';
    },
    onMove(event) {
      if (event.target.type !== 'item') {
        return;
      }

      const [draggedKey] = event.keys;
      const draggedItem = getCollectionItemByKey(draggedKey);
      const targetItem = getCollectionItemByKey(event.target.key);
      if (!draggedItem || !targetItem || !canDropCollectionItem(draggedItem, targetItem)) {
        return;
      }

      const id = draggedItem.doc._id;
      const targetId = targetItem.doc._id;
      const workspaceCollectionItems = collectionItems.filter(item => item.workspace._id === draggedItem.workspace._id);

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
        const isDraggable = collectionItemsById.has(props.key.toString());

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
  }, [collectionDragAndDrop.dragAndDropHooks, collectionItemsById]);
};
