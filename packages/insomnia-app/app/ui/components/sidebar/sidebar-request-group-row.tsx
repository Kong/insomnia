import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';
import { PropsWithChildren } from 'react';
import { createRef } from 'react';
import { DragSource, DragSourceSpec, DropTarget, DropTargetMonitor, DropTargetSpec } from 'react-dnd';
import { connect } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { HotKeyRegistry } from '../../../common/hotkeys';
import * as misc from '../../../common/misc';
import { HandleRender } from '../../../common/render';
import { RequestGroup } from '../../../models/request-group';
import { RootState } from '../../redux/modules';
import { selectActiveEnvironment, selectActiveRequest } from '../../redux/selectors';
import Highlight from '../base/highlight';
import { RequestGroupActionsDropdown, UnconnectedRequestGroupActionsDropdown } from '../dropdowns/request-group-actions-dropdown';
import { showModal } from '../modals';
import RequestGroupSettingsModal from '../modals/request-group-settings-modal';
import { DnDDragProps, DnDDropProps, DnDProps, DragObject, dropHandleCreator, hoverHandleCreator, sourceCollect, targetCollect } from './dnd';
import { SidebarRequestRow } from './sidebar-request-row';

type ReduxProps = ReturnType<typeof mapStateToProps>;

const mapStateToProps = (state: RootState) => ({
  activeProject: selectActiveRequest(state), // TODO this seems wrong (!?!)
  activeEnvironment: selectActiveEnvironment(state),
});

interface Props extends DnDProps, ReduxProps, PropsWithChildren<{}> {
  handleSetRequestGroupCollapsed: Function;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => any;
  handleActivateRequest: Function;
  handleCreateRequest: (id: string) => any;
  handleCreateRequestGroup: (requestGroup: string) => any;
  handleRender: HandleRender;
  filter: string;
  isActive: boolean;
  isCollapsed: boolean;
  requestGroup: RequestGroup;
  hotKeyRegistry: HotKeyRegistry;
}

interface State {
  dragDirection: number;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class UnconnectedSidebarRequestGroupRow extends PureComponent<Props, State> {
  state: State = {
    dragDirection: 0,
  };

  private dropdownRef = createRef<UnconnectedRequestGroupActionsDropdown>();
  private expandTagRef = createRef<HTMLDivElement>();

  getExpandTag() {
    return this.expandTagRef.current;
  }

  _handleCollapse() {
    const { requestGroup, handleSetRequestGroupCollapsed, isCollapsed } = this.props;
    handleSetRequestGroupCollapsed(requestGroup._id, !isCollapsed);
  }

  _handleShowActions(e) {
    e.preventDefault();

    this.dropdownRef.current?.show();
  }

  setDragDirection(dragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({
        dragDirection,
      });
    }
  }

  _handleShowRequestGroupSettings() {
    showModal(RequestGroupSettingsModal, {
      requestGroup: this.props.requestGroup,
    });
  }

  render() {
    const {
      connectDragSource,
      connectDropTarget,
      filter,
      children,
      requestGroup,
      isCollapsed,
      isActive,
      handleCreateRequest,
      handleCreateRequestGroup,
      handleDuplicateRequestGroup,
      handleRender,
      isDragging,
      isDraggingOver,
      hotKeyRegistry,
    } = this.props;
    const { dragDirection } = this.state;
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
        <button onClick={this._handleCollapse} onContextMenu={this._handleShowActions}>
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
              ref={this.expandTagRef}
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
        <div
          className={classnames('sidebar__item sidebar__item--big', {
            'sidebar__item--active': isActive,
          })}
        >
          {button}
          <div className="sidebar__actions">
            <RequestGroupActionsDropdown
              ref={this.dropdownRef}
              handleCreateRequest={handleCreateRequest}
              handleCreateRequestGroup={handleCreateRequestGroup}
              handleDuplicateRequestGroup={handleDuplicateRequestGroup}
              handleShowSettings={this._handleShowRequestGroupSettings}
              requestGroup={requestGroup}
              hotKeyRegistry={hotKeyRegistry}
              right
            />
          </div>
        </div>

        <ul
          className={classnames('sidebar__list', {
            'sidebar__list--collapsed': isCollapsed,
          })}
        >
          {!isCollapsed && React.Children.count(children) > 0 ? (
            children
          ) : (
            <SidebarRequestRow
              handleActivateRequest={misc.nullFn}
              handleDuplicateRequest={misc.nullFn}
              handleGenerateCode={misc.nullFn}
              handleCopyAsCurl={misc.nullFn}
              handleSetRequestPinned={misc.nullFn}
              handleRender={handleRender}
              isActive={false}
              requestGroup={requestGroup}
              requestCreate={handleCreateRequest}
              filter={filter}
              hotKeyRegistry={hotKeyRegistry}
              isPinned={false} // Necessary so that plugin actions work
            />
          )}
        </ul>
      </li>
    );
  }
}

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

function isOnExpandTag(monitor: DropTargetMonitor, component: UnconnectedSidebarRequestGroupRow): boolean {
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
  hover: (props, monitor, component) => {
    if (props.isCollapsed && isOnExpandTag(monitor, component)) {
      component.props.handleSetRequestGroupCollapsed(props.requestGroup._id, false);
      component.setDragDirection(0);
    } else {
      hoverHandle(props, monitor, component);
    }
  },
};

const source = DragSource<Props, DnDDragProps, DragObject>('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(UnconnectedSidebarRequestGroupRow);
const target = DropTarget<Props, DnDDropProps>('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);
const connected = connect(mapStateToProps)(target);

export const SidebarRequestGroupRow = connected;
