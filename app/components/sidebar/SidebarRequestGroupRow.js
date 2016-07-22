import React, {PropTypes, Component} from 'react';
import ReactDOM from 'react-dom';
import {DragSource, DropTarget} from 'react-dnd'
import classnames from 'classnames';

import RequestGroupActionsDropdown from '../../containers/RequestGroupActionsDropdown';
import SidebarRequestRow from './SidebarRequestRow';

class SidebarRequestGroupRow extends Component {
  constructor (props) {
    super(props);

    this.state = {
      dragDirection: 0
    }
  }

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
      isActive,
      toggleRequestGroup,
      addRequestToRequestGroup,
      isDragging,
      isDraggingOver,
    } = this.props;

    const {dragDirection} = this.state;

    let folderIconClass = 'fa-folder';
    let expanded = !requestGroup.metaCollapsed;

    folderIconClass += !expanded ? '' : '-open';
    folderIconClass += isActive ? '' : '-o';

    const classes = classnames('sidebar__row', {
      'sidebar__row--dragging': isDragging,
      'sidebar__row--dragging-above': isDraggingOver && dragDirection > 0,
      'sidebar__row--dragging-below': isDraggingOver && dragDirection < 0
    });

    return connectDragSource(connectDropTarget(
      <li key={requestGroup._id} className={classes}>
        <div className={classnames('sidebar__item sidebar__item--big', {'sidebar__item--active': isActive})}>
          <button onClick={e => toggleRequestGroup(requestGroup)}>
            <div className="sidebar__clickable">
              <i className={'sidebar__item__icon fa ' + folderIconClass}></i>
              <span>{requestGroup.name}</span>
            </div>
          </button>

          <div className="sidebar__actions">
            <button onClick={(e) => addRequestToRequestGroup(requestGroup)}>
              <i className="fa fa-plus-circle"></i>
            </button>
            <RequestGroupActionsDropdown
              requestGroup={requestGroup}
              right={true}
            />
          </div>
        </div>

        <ul className="sidebar__list">
          {!expanded || children.length > 0 ? null : (
            <SidebarRequestRow
              activateRequest={() => null}
              moveRequest={moveRequest}
              isActive={false}
              request={null}
              requestGroup={requestGroup}
            />
          )}
          {expanded ? children : null}
        </ul>
      </li>
    ));
  }
}

SidebarRequestGroupRow.propTypes = {
  // Functions
  toggleRequestGroup: PropTypes.func.isRequired,
  addRequestToRequestGroup: PropTypes.func.isRequired,
  moveRequestGroup: PropTypes.func.isRequired,
  moveRequest: PropTypes.func.isRequired,

  // Other
  isActive: PropTypes.bool.isRequired,
  requestGroup: PropTypes.object.isRequired,

  // React DnD
  isDragging: PropTypes.bool.isRequired,
  isDraggingOver: PropTypes.bool.isRequired,
  connectDragSource: PropTypes.func.isRequired,
  connectDropTarget: PropTypes.func.isRequired
};

/**
 * Implements the drag source contract.
 */
const dragSource = {
  beginDrag(props) {
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

const source = DragSource('SIDEBAR_ROW_2', dragSource, sourceCollect)(SidebarRequestGroupRow);
const target = DropTarget('SIDEBAR_ROW_2', dragTarget, targetCollect)(source);
export default target;
