import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import ReactDOM from 'react-dom';
import { DragSource, DropTarget } from 'react-dnd';
import classnames from 'classnames';
import Highlight from '../base/highlight';
import RequestGroupActionsDropdown from '../dropdowns/request-group-actions-dropdown';
import SidebarRequestRow from './sidebar-request-row';
import * as misc from '../../../common/misc';
import { showModal } from '../modals';
import RequestGroupSettingsModal from '../modals/request-group-settings-modal';
import { RequestGroup } from '../../../models/request-group';
import { Workspace } from '../../../models/workspace';
import { Environment } from '../../../models/environment';
import { HotKeyRegistry } from '../../../common/hotkeys';
import { HandleRender } from '../../../common/render';

interface Props {
  handleSetRequestGroupCollapsed: Function;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => any;
  moveDoc: Function;
  handleActivateRequest: Function;
  handleCreateRequest: (id: string) => any;
  handleCreateRequestGroup: (requestGroup: string) => any;
  handleRender: HandleRender;
  filter: string;
  isActive: boolean;
  isCollapsed: boolean;
  workspace: Workspace;
  requestGroup: RequestGroup;
  hotKeyRegistry: HotKeyRegistry;
  isDragging?: boolean;
  isDraggingOver?: boolean;
  connectDragSource?: Function;
  connectDropTarget?: Function;
  activeEnvironment?: Environment | null;
}

interface State {
  dragDirection: number;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class SidebarRequestGroupRow extends PureComponent<Props, State> {
  state: State = {
    dragDirection: 0,
  }

  _requestGroupActionsDropdown: RequestGroupActionsDropdown | null = null;
  _expandTag: HTMLDivElement | null = null;

  _setRequestGroupActionsDropdownRef(n: RequestGroupActionsDropdown) {
    this._requestGroupActionsDropdown = n;
  }

  _setExpandTagRef(n: HTMLDivElement) {
    this._expandTag = n;
  }

  getExpandTag() {
    return this._expandTag;
  }

  _handleCollapse() {
    const { requestGroup, handleSetRequestGroupCollapsed, isCollapsed } = this.props;
    handleSetRequestGroupCollapsed(requestGroup._id, !isCollapsed);
  }

  _handleShowActions(e) {
    e.preventDefault();

    this._requestGroupActionsDropdown?.show();
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
      moveDoc,
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
      workspace,
      hotKeyRegistry,
      activeEnvironment,
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
    // @ts-expect-error -- TSCONVERSION
    const button = connectDragSource(
      // @ts-expect-error -- TSCONVERSION
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
              ref={this._setExpandTagRef}
              className={classnames('sidebar__expand', {
                'sidebar__expand-hint': isDraggingOver && isCollapsed,
              })}>
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
          })}>
          {button}
          <div className="sidebar__actions">
            <RequestGroupActionsDropdown
              ref={this._setRequestGroupActionsDropdownRef}
              handleCreateRequest={handleCreateRequest}
              handleCreateRequestGroup={handleCreateRequestGroup}
              handleDuplicateRequestGroup={handleDuplicateRequestGroup}
              handleShowSettings={this._handleShowRequestGroupSettings}
              workspace={workspace}
              requestGroup={requestGroup}
              hotKeyRegistry={hotKeyRegistry}
              activeEnvironment={activeEnvironment}
              // @ts-expect-error -- TSCONVERSION
              right
            />
          </div>
        </div>

        <ul
          className={classnames('sidebar__list', {
            'sidebar__list--collapsed': isCollapsed,
          })}>
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
              moveDoc={moveDoc}
              isActive={false}
              requestGroup={requestGroup}
              requestCreate={handleCreateRequest}
              filter={filter}
              hotKeyRegistry={hotKeyRegistry}
              isPinned={false} // Necessary so that plugin actions work
              activeEnvironment={activeEnvironment}
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
const dragSource = {
  beginDrag(props: Props) {
    return {
      requestGroup: props.requestGroup,
    };
  },
};

function isAbove(monitor, component) {
  const hoveredNode = ReactDOM.findDOMNode(component);
  // @ts-expect-error -- TSCONVERSION
  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  const draggedTop = monitor.getSourceClientOffset().y;
  return hoveredTop > draggedTop;
}

function isOnExpandTag(monitor, component) {
  const rect = component.getExpandTag().getBoundingClientRect();
  const pointer = monitor.getClientOffset();
  return (
    rect.left <= pointer.x &&
    pointer.x <= rect.right &&
    rect.top <= pointer.y &&
    pointer.y <= rect.bottom
  );
}

const dragTarget = {
  drop(props, monitor, component) {
    const movingDoc = monitor.getItem().requestGroup || monitor.getItem().request;
    const parentId = props.requestGroup.parentId;
    const targetId = props.requestGroup._id;

    if (isAbove(monitor, component)) {
      props.moveDoc(movingDoc, parentId, targetId, 1);
    } else {
      props.moveDoc(movingDoc, parentId, targetId, -1);
    }
  },

  hover(props, monitor, component) {
    if (props.isCollapsed && isOnExpandTag(monitor, component)) {
      component.props.handleSetRequestGroupCollapsed(props.requestGroup._id, false);
      component.setDragDirection(0);
    } else if (isAbove(monitor, component)) {
      component.setDragDirection(1);
    } else {
      component.setDragDirection(-1);
    }
  },
};

function sourceCollect(connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging(),
  };
}

function targetCollect(connect, monitor) {
  return {
    connectDropTarget: connect.dropTarget(),
    isDraggingOver: monitor.isOver(),
  };
}

const source = DragSource('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(SidebarRequestGroupRow);
export default DropTarget('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);
