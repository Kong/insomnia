import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import ReactDOM from 'react-dom';
import { DragSource, DropTarget } from 'react-dnd';
import classnames from 'classnames';
import Highlight from '../base/highlight';
import RequestGroupActionsDropdown from '../dropdowns/request-group-actions-dropdown';
import SidebarRequestRow from './sidebar-request-row';
import * as misc from '../../../common/misc';

@autobind
class SidebarRequestGroupRow extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dragDirection: 0,
    };
  }

  _setRequestGroupActionsDropdownRef(n) {
    this._requestGroupActionsDropdown = n;
  }

  _setExpandTagRef(n) {
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
    this._requestGroupActionsDropdown.show();
  }

  setDragDirection(dragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({ dragDirection });
    }
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
      handleMoveRequestGroup,
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
              handleMoveRequestGroup={handleMoveRequestGroup}
              workspace={workspace}
              requestGroup={requestGroup}
              hotKeyRegistry={hotKeyRegistry}
              activeEnvironment={activeEnvironment}
              right
            />
          </div>
        </div>

        <ul
          className={classnames('sidebar__list', {
            'sidebar__list--collapsed': isCollapsed,
          })}>
          {!isCollapsed && children.length > 0 ? (
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
              request={null}
              requestGroup={requestGroup}
              workspace={workspace}
              requestCreate={handleCreateRequest}
              filter={filter}
              hotKeyRegistry={hotKeyRegistry}
              isPinned={false}
            />
          )}
        </ul>
      </li>
    );
  }
}

SidebarRequestGroupRow.propTypes = {
  // Functions
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  handleDuplicateRequestGroup: PropTypes.func.isRequired,
  handleMoveRequestGroup: PropTypes.func.isRequired,
  moveDoc: PropTypes.func.isRequired,
  handleActivateRequest: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  handleRender: PropTypes.func.isRequired,

  // Other
  filter: PropTypes.string.isRequired,
  isActive: PropTypes.bool.isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  workspace: PropTypes.object.isRequired,
  requestGroup: PropTypes.object.isRequired,
  hotKeyRegistry: PropTypes.object.isRequired,

  // React DnD
  isDragging: PropTypes.bool,
  isDraggingOver: PropTypes.bool,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,

  // Optional
  children: PropTypes.node,
  activeEnvironment: PropTypes.object,
};

/**
 * Implements the drag source contract.
 */
const dragSource = {
  beginDrag(props) {
    return {
      requestGroup: props.requestGroup,
    };
  },
};

function isAbove(monitor, component) {
  const hoveredNode = ReactDOM.findDOMNode(component);

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
