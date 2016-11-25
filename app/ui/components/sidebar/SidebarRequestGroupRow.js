import React, {PropTypes, Component} from 'react';
import ReactDOM from 'react-dom';
import {DragSource, DropTarget} from 'react-dnd'
import classnames from 'classnames';

import RequestGroupActionsDropdown from '../dropdowns/RequestGroupActionsDropdown';
import SidebarRequestRow from './SidebarRequestRow';
import {trackEvent} from '../../../analytics/index';

class SidebarRequestGroupRow extends Component {
  state = {dragDirection: 0};

  _handleCollapse = () => {
    const {requestGroup, handleSetRequestGroupCollapsed, isCollapsed} = this.props;
    handleSetRequestGroupCollapsed(requestGroup._id, !isCollapsed);
    trackEvent('Folder', 'Toggle Visible', !isCollapsed ? 'Close' : 'Open')
  };

  _nullFunction = () => null;

  setDragDirection (dragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({dragDirection})
    }
  }

  render () {
    const {
      connectDragSource,
      connectDropTarget,
      moveRequest,
      children,
      requestGroup,
      isCollapsed,
      isActive,
      handleActivateRequest,
      handleCreateRequest,
      handleCreateRequestGroup,
      isDragging,
      isDraggingOver,
      workspace,
    } = this.props;

    const {dragDirection} = this.state;

    let folderIconClass = 'fa-folder';

    folderIconClass += isCollapsed ? '' : '-open';
    folderIconClass += isActive ? '' : '-o';

    const classes = classnames('sidebar__row', {
      'sidebar__row--dragging': isDragging,
      'sidebar__row--dragging-above': isDraggingOver && dragDirection > 0,
      'sidebar__row--dragging-below': isDraggingOver && dragDirection < 0
    });

    return connectDragSource(connectDropTarget(
      <li key={requestGroup._id} className={classes}>
        <div
          className={classnames('sidebar__item sidebar__item--big', {'sidebar__item--active': isActive})}>
          <button onClick={this._handleCollapse}>
            <div className="sidebar__clickable">
              <i className={'sidebar__item__icon fa ' + folderIconClass}></i>
              <span>{requestGroup.name}</span>
            </div>
          </button>

          <div className="sidebar__actions">
            <RequestGroupActionsDropdown
              handleActivateRequest={handleActivateRequest}
              handleCreateRequest={handleCreateRequest}
              handleCreateRequestGroup={handleCreateRequestGroup}
              workspace={workspace}
              requestGroup={requestGroup}
              right={true}
            />
          </div>
        </div>

        <ul className="sidebar__list">
          {!isCollapsed && children.length === 0 ? (
            <SidebarRequestRow
              handleActivateRequest={this._nullFunction}
              moveRequest={moveRequest}
              isActive={false}
              request={null}
              requestGroup={requestGroup}
              workspace={workspace}
              requestCreate={handleCreateRequest}
            />
          ) : null}
          {isCollapsed ? null : children}
        </ul>
      </li>
    ));
  }
}

SidebarRequestGroupRow.propTypes = {
  // Functions
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  moveRequestGroup: PropTypes.func.isRequired,
  moveRequest: PropTypes.func.isRequired,
  handleActivateRequest: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,

  // Other
  isActive: PropTypes.bool.isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  workspace: PropTypes.object.isRequired,
  requestGroup: PropTypes.object.isRequired,

  // React DnD
  isDragging: PropTypes.bool,
  isDraggingOver: PropTypes.bool,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func
};

/**
 * Implements the drag source contract.
 */
const dragSource = {
  beginDrag(props) {
    trackEvent('Folder', 'Drag', 'Begin');
    return {
      requestGroup: props.requestGroup
    };
  }
};


function isAbove (monitor, component) {
  const hoveredNode = ReactDOM.findDOMNode(component);

  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  const draggedTop = monitor.getSourceClientOffset().y;

  return hoveredTop > draggedTop;
}

const dragTarget = {
  drop (props, monitor, component) {
    if (isAbove(monitor, component)) {
      props.moveRequestGroup(monitor.getItem().requestGroup, props.requestGroup, 1);
    } else {
      props.moveRequestGroup(monitor.getItem().requestGroup, props.requestGroup, -1);
    }
  },
  hover (props, monitor, component) {
    if (isAbove(monitor, component)) {
      component.decoratedComponentInstance.setDragDirection(1);
    } else {
      component.decoratedComponentInstance.setDragDirection(-1);
    }
  }
};

function sourceCollect (connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    isDragging: monitor.isDragging()
  };
}

function targetCollect (connect, monitor) {
  return {
    connectDropTarget: connect.dropTarget(),
    isDraggingOver: monitor.isOver()
  };
}

const source = DragSource('SIDEBAR_REQUEST_GROUP_ROW', dragSource, sourceCollect)(SidebarRequestGroupRow);
const target = DropTarget('SIDEBAR_REQUEST_GROUP_ROW', dragTarget, targetCollect)(source);
export default target;
