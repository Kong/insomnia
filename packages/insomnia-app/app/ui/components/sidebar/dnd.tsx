import { DragSourceConnector, DragSourceMonitor, DropTargetConnector, DropTargetMonitor, DropTargetSpec } from 'react-dnd';
import ReactDOM from 'react-dom';

import { GrpcRequest } from '../../../models/grpc-request';
import { Request } from '../../../models/request';
import { RequestGroup } from '../../../models/request-group';

export interface DnDProps extends ReturnType<typeof sourceCollect>, ReturnType<typeof targetCollect> {
  moveDoc: Function;
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
  const hoveredNode = ReactDOM.findDOMNode(component);
  // @ts-expect-error -- TSCONVERSION
  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  const draggedTop = monitor.getSourceClientOffset()?.y;
  return draggedTop && hoveredTop > draggedTop;
};

interface DropProps extends DnDProps {
  requestGroup?: RequestGroup;
  request?: Request | GrpcRequest;
}

export const dropHandleCreator = <T extends DropProps>(): Required<DropTargetSpec<T>>['drop'] =>
  (props, monitor, component) => {
    const movingDoc = monitor.getItem().requestGroup || monitor.getItem().request;
    const parentId = props.requestGroup ? props.requestGroup._id : props.request?.parentId;
    const targetId = props.request ? props.request._id : null;

    if (isAbove(monitor, component)) {
      props.moveDoc(movingDoc, parentId, targetId, 1);
    } else {
      props.moveDoc(movingDoc, parentId, targetId, -1);
    }
  };

export const hoverHandleCreator = <T extends DropProps>(): Required<DropTargetSpec<T>>['hover'] =>
  (_, monitor, component) => {
    if (isAbove(monitor, component)) {
      component.setDragDirection(1);
    } else {
      component.setDragDirection(-1);
    }
  };