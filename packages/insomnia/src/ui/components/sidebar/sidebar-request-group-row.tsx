import classnames from 'classnames';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PropsWithChildren } from 'react';
import { DragSource, DragSourceSpec, DropTarget, DropTargetMonitor, DropTargetSpec } from 'react-dnd';

import * as models from '../../../models/index';
import { RequestGroup } from '../../../models/request-group';
import { Highlight } from '../base/highlight';
import { RequestGroupActionsDropdown, RequestGroupActionsDropdownHandle } from '../dropdowns/request-group-actions-dropdown';
import { showModal } from '../modals';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';
import { DnDDragProps, DnDDropProps, DnDProps, DragObject, dropHandleCreator, hoverHandleCreator, sourceCollect, targetCollect } from './dnd';
import { SidebarRequestRow } from './sidebar-request-row';

interface Props extends DnDProps, PropsWithChildren<{}> {
  filter: string;
  isActive: boolean;
  isCollapsed: boolean;
  requestGroup: RequestGroup;
}
interface SidebarRequestGroupRowHandle {
  getExpandTag: () => HTMLSpanElement | null;
  setDragDirection: (direction: number) => void;
}

export const SidebarRequestGroupRowFC = forwardRef<SidebarRequestGroupRowHandle, Props>(({
  connectDragSource,
  connectDropTarget,
  filter,
  children,
  requestGroup,
  isCollapsed,
  isActive,
  isDragging,
  isDraggingOver,
}, ref) => {
  const [dragDirection, setDragDirection] = useState(0);
  const dropdownRef = useRef<RequestGroupActionsDropdownHandle>(null);
  const expandTagRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setDragDirection,
    getExpandTag:() => expandTagRef.current,
  }));

  let folderIconClass = 'fa-folder';
  folderIconClass += isCollapsed ? '' : '-open';
  folderIconClass += isActive ? '' : '-o';
  const classes = classnames('sidebar__row', {
    'sidebar__row--dragging': isDragging,
    'sidebar__row--dragging-above': isDraggingOver && dragDirection > 0,
    'sidebar__row--dragging-below': isDraggingOver && dragDirection < 0,
  });
  // NOTE: We only want the button draggable, not the whole container (ie. no children)
  const button = connectDragSource(
    connectDropTarget(
      <button
        onClick={async () => {
          const requestGroupMeta = await models.requestGroupMeta.getByParentId(requestGroup._id);
          if (requestGroupMeta) {
            models.requestGroupMeta.update(requestGroupMeta, { collapsed: !isCollapsed });
            return;
          }
          models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: false });
        }}
        onContextMenu={event => {
          event.preventDefault();
          dropdownRef.current?.show();
        }}
      >
        <div className="sidebar__clickable">
          <i
            className={classnames(
              'sidebar__item__icon-right',
              'fa',
              'space-right',
              folderIconClass,
            )}
          />
          <Highlight search={filter} text={requestGroup.name} />
          <div
            ref={expandTagRef}
            className={classnames('sidebar__expand', {
              'sidebar__expand-hint': isDraggingOver && isCollapsed,
            })}
          >
            <div className="tag tag--no-bg tag--small">
              <span className="tag__inner">OPEN</span>
            </div>
          </div>
        </div>
      </button>,
    ),
  );
  return (
    <li key={requestGroup._id} className={classes}>
      <div className={classnames('sidebar__item sidebar__item--big', { 'sidebar__item--active': isActive })}>
        {button}
        <div className="sidebar__actions">
          <RequestGroupActionsDropdown
            ref={dropdownRef}
            handleShowSettings={() => showModal(RequestGroupSettingsModal, { requestGroup })}
            requestGroup={requestGroup}
            right
          />
        </div>
      </div>
      <ul className={classnames('sidebar__list', { 'sidebar__list--collapsed': isCollapsed })}>
        {!isCollapsed && React.Children.count(children) > 0 ? children :
          (<SidebarRequestRow
            isActive={false}
            requestGroup={requestGroup}
            filter={filter}
            isPinned={false}
          />)}
      </ul>
    </li>
  );
});
SidebarRequestGroupRowFC.displayName = 'SidebarRequestGroupRowFC';
/**
 * Implements the drag source contract.
 */
const dragSource: DragSourceSpec<Props, DragObject> = {
  beginDrag(props: Props) {
    return {
      item: props.requestGroup,
    };
  },
};

function isOnExpandTag(monitor: DropTargetMonitor, component: SidebarRequestGroupRowHandle): boolean {
  const rect = component.getExpandTag()?.getBoundingClientRect();
  const pointer = monitor.getClientOffset();

  if (!pointer || !rect) {
    return false;
  }

  return (
    rect.left <= pointer.x &&
    pointer.x <= rect.right &&
    rect.top <= pointer.y &&
    pointer.y <= rect.bottom
  );
}

const hoverHandle = hoverHandleCreator<Props>();

const dropHandle = dropHandleCreator<Props>({
  getParentId: props => props.requestGroup.parentId,
  getTargetId: props => props.requestGroup._id,
});

const dragTarget: DropTargetSpec<Props> = {
  drop: dropHandle,
  hover: async (props, monitor, component: SidebarRequestGroupRowHandle) => {
    if (props.isCollapsed && isOnExpandTag(monitor, component)) {
      const requestGroupMeta = await models.requestGroupMeta.getByParentId(props.requestGroup._id);
      if (requestGroupMeta) {
        models.requestGroupMeta.update(requestGroupMeta, { collapsed: false });
      } else {
        models.requestGroupMeta.create({ parentId: props.requestGroup._id, collapsed: false });
      }
      component.setDragDirection(0);
    } else {
      hoverHandle(props, monitor, component);
    }
  },
};

const source = DragSource<Props, DnDDragProps, DragObject>('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(SidebarRequestGroupRowFC);
const target = DropTarget<Props, DnDDropProps>('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);
export const SidebarRequestGroupRow = target;
