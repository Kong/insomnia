import { DragSourceConnector, DragSourceMonitor, DropTargetConnector, DropTargetMonitor, DropTargetSpec } from 'react-dnd';
import ReactDOM from 'react-dom';

import { database } from '../../../common/database';
import { BaseModel } from '../../../models';
import * as models from '../../../models';
import { GrpcRequest } from '../../../models/grpc-request';
import * as requestOperations from '../../../models/helpers/request-operations';
import { Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import { WebSocketRequest } from '../../../models/websocket-request';

export type DnDDragProps = ReturnType<typeof sourceCollect>;
export type DnDDropProps = ReturnType<typeof targetCollect>;
export type DnDProps =  DnDDragProps & DnDDropProps;

export interface DragObject {
  item?: GrpcRequest | Request | WebSocketRequest | RequestGroup;
}

export const sourceCollect = (connect: DragSourceConnector, monitor: DragSourceMonitor) => ({
  connectDragSource: connect.dragSource(),
  isDragging: monitor.isDragging(),
});

export const targetCollect = (connect: DropTargetConnector, monitor: DropTargetMonitor) => ({
  connectDropTarget: connect.dropTarget(),
  isDraggingOver: monitor.isOver(),
});

export const isAbove = (monitor: DropTargetMonitor, component: any) => {
  let hoveredNode;
  try {
    // Try to find the node if it's a class component
    hoveredNode = ReactDOM.findDOMNode(component);
  } catch (error: unknown) {
    // Try to find the component if it's a function component
    hoveredNode = component.node;
  }
  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  const draggedTop = monitor.getSourceClientOffset()?.y;
  return draggedTop && hoveredTop > draggedTop;
};

export const dropHandleCreator = <Props extends Object>(
  {
    getParentId,
    getTargetId,
  }: {
    getParentId: (props: Props) => string | undefined;
    getTargetId: (props: Props) => string | undefined;
  }
): Required<DropTargetSpec<Props>>['drop'] =>
    (props, monitor, component) => {
      // the item comes from the dragSource
      const movingDoc = (monitor.getItem() as DragObject).item;
      const parentId = getParentId(props);
      const targetId = getTargetId(props);

      if (!movingDoc || !parentId) {
        return;
      }

      if (isAbove(monitor, component)) {
        moveDoc({ docToMove: movingDoc, parentId, targetId, targetOffset: 1 });
      } else {
        moveDoc({ docToMove: movingDoc, parentId, targetId, targetOffset: -1 });
      }
    };

export const hoverHandleCreator = <Props extends Object>(): Required<DropTargetSpec<Props>>['hover'] =>
  (_, monitor, component) => {
    if (isAbove(monitor, component)) {
      component.setDragDirection(1);
    } else {
      component.setDragDirection(-1);
    }
  };

const moveDoc = async ({
  docToMove,
  parentId,
  targetId,
  targetOffset,
}: {
  docToMove: BaseModel;
  parentId: string;
  targetId?: string;
  targetOffset: number;
}) => {
  // Nothing to do. We are in the same spot as we started
  if (docToMove._id === targetId) {
    return;
  }

  // Don't allow dragging things into itself or children. This will disconnect
  // the node from the tree and cause the item to no longer show in the UI.
  const descendents = await database.withDescendants(docToMove);

  for (const doc of descendents) {
    if (doc._id === parentId) {
      return;
    }
  }

  function __updateDoc(doc: BaseModel, patch: any) {
    if (isRequestGroup(doc)) {
      return models.requestGroup.update(doc, patch);
    }
    return requestOperations.update(doc, patch);
  }

  if (!targetId) {
    // We are moving to an empty area. No sorting required
    await __updateDoc(docToMove, { parentId });
    return;
  }

  // NOTE: using requestToTarget's parentId so we can switch parents!
  const docs = [
    ...(await models.request.findByParentId(parentId)),
    ...(await models.webSocketRequest.findByParentId(parentId)),
    ...(await models.grpcRequest.findByParentId(parentId)),
    ...(await models.requestGroup.findByParentId(parentId)),
  ].sort((a, b) => (a.metaSortKey < b.metaSortKey ? -1 : 1));

  // Find the index of doc B so we can re-order and save everything
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    if (doc._id === targetId) {
      let before, after;

      if (targetOffset < 0) {
        // We're moving to below
        before = docs[i];
        after = docs[i + 1];
      } else {
        // We're moving to above
        before = docs[i - 1];
        after = docs[i];
      }

      const beforeKey = before ? before.metaSortKey : docs[0].metaSortKey - 100;
      const afterKey = after ? after.metaSortKey : docs[docs.length - 1].metaSortKey + 100;

      if (Math.abs(afterKey - beforeKey) < 0.000001) {
        // If sort keys get too close together, we need to redistribute the list. This is
        // not performant at all (need to update all siblings in DB), but it is extremely rare
        // anyway
        console.log(`[app] Recreating Sort Keys ${beforeKey} ${afterKey}`);
        await database.bufferChanges(300);
        docs.map((r, i) =>
          __updateDoc(r, {
            metaSortKey: i * 100,
            parentId,
          }),
        );
      } else {
        const metaSortKey = afterKey - (afterKey - beforeKey) / 2;

        __updateDoc(docToMove, {
          metaSortKey,
          parentId,
        });
      }

      break;
    }
  }
};
