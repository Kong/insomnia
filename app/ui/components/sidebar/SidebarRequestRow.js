import React, {PropTypes, Component} from 'react';
import ReactDOM from 'react-dom';
import {DragSource, DropTarget} from 'react-dnd';
import classnames from 'classnames';
import RequestActionsDropdown from '../dropdowns/RequestActionsDropdown';
import Editable from '../base/Editable';
import MethodTag from '../tags/MethodTag';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';


class SidebarRequestRow extends Component {

  state = {dragDirection: 0};

  _handleRequestCreateFromEmpty = () => {
    const parentId = this.props.requestGroup._id;
    this.props.requestCreate(parentId);
    trackEvent('Request', 'Create', 'Empty Folder');
  };

  _handleRequestActivate = () => {
    const {isActive, request, handleActivateRequest} = this.props;

    if (isActive) {
      return;
    }

    handleActivateRequest(request._id);
    trackEvent('Request', 'Activate', 'Sidebar');
  };

  setDragDirection (dragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({dragDirection})
    }
  }

  render () {
    const {
      connectDragSource,
      connectDropTarget,
      isDragging,
      isDraggingOver,
      request,
      requestGroup,
      isActive,
    } = this.props;

    const {dragDirection} = this.state;

    let node;

    const classes = classnames('sidebar__row', {
      'sidebar__row--dragging': isDragging,
      'sidebar__row--dragging-above': isDraggingOver && dragDirection > 0,
      'sidebar__row--dragging-below': isDraggingOver && dragDirection < 0
    });

    if (!request) {
      node = (
        <li className={classes}>
          <div className="sidebar__item" tabIndex={0}>
            <button className="sidebar__clickable"
                    onClick={this._handleRequestCreateFromEmpty}>
              <em>click to add first request...</em>
            </button>
          </div>
        </li>
      )
    } else {
      node = (
        <li className={classes}>
          <div className={classnames('sidebar__item', {'sidebar__item--active': isActive})}>
            <button className="wide" onClick={this._handleRequestActivate}>
              <div className="sidebar__clickable">
                <MethodTag method={request.method}/>
                <Editable
                  value={request.name}
                  onEditStart={() => trackEvent('Request', 'Rename', 'In Place')}
                  onSubmit={name => models.request.update(request, {name})}
                />
              </div>
            </button>

            <div className="sidebar__actions">
              <RequestActionsDropdown
                right={true}
                request={request}
                requestGroup={requestGroup}
              />
            </div>

          </div>
        </li>
      )
    }

    return connectDragSource(connectDropTarget(node));
  }
}

SidebarRequestRow.propTypes = {
  // Functions
  handleActivateRequest: PropTypes.func.isRequired,
  requestCreate: PropTypes.func.isRequired,
  moveRequest: PropTypes.func.isRequired,

  // Other
  isActive: PropTypes.bool.isRequired,

  // React DnD
  isDragging: PropTypes.bool,
  isDraggingOver: PropTypes.bool,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,

  // Optional
  requestGroup: PropTypes.object,
  request: PropTypes.object
};

/**
 * Implements the drag source contract.
 */
const dragSource = {
  beginDrag(props) {
    trackEvent('Request', 'Drag', 'Begin');
    return {
      request: props.request
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
    const {request} = monitor.getItem();
    const targetRequest = props.request;

    const {requestGroup} = props;
    const requestGroupId = requestGroup ? requestGroup._id : null;
    const parentId = targetRequest ? targetRequest.parentId : requestGroupId;
    const targetId = targetRequest ? targetRequest._id : null;

    if (isAbove(monitor, component)) {
      props.moveRequest(request, parentId, targetId, 1);
    } else {
      props.moveRequest(request, parentId, targetId, -1);
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

const source = DragSource('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(SidebarRequestRow);
const target = DropTarget('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);
export default target;
