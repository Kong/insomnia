import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import ReactDOM from 'react-dom';
import { DragSource, DropTarget } from 'react-dnd';
import classnames from 'classnames';
import RequestActionsDropdown from '../dropdowns/request-actions-dropdown';
import Editable from '../base/editable';
import Highlight from '../base/highlight';
import MethodTag from '../tags/method-tag';
import * as models from '../../../models';
import { showModal } from '../modals/index';
import RequestSettingsModal from '../modals/request-settings-modal';
import { CONTENT_TYPE_GRAPHQL } from '../../../common/constants';
import { getMethodOverrideHeader } from '../../../common/misc';

@autobind
class SidebarRequestRow extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      dragDirection: 0,
      isEditing: false,
      renderedUrl: '',
    };
    this._urlUpdateInterval = null;
  }

  _setRequestActionsDropdownRef(n) {
    this._requestActionsDropdown = n;
  }

  _handleShowRequestActions(e) {
    e.preventDefault();
    this._requestActionsDropdown.show();
  }

  _handleEditStart() {
    this.setState({ isEditing: true });
  }

  _handleRequestUpdateName(name) {
    models.request.update(this.props.request, { name });
    this.setState({ isEditing: false });
  }

  _handleRequestCreateFromEmpty() {
    const parentId = this.props.requestGroup._id;
    this.props.requestCreate(parentId);
  }

  _handleRequestActivate() {
    const { isActive, request, handleActivateRequest } = this.props;

    if (isActive) {
      return;
    }

    handleActivateRequest(request._id);
  }

  _handleShowRequestSettings() {
    showModal(RequestSettingsModal, { request: this.props.request });
  }

  _getMethodOverrideHeaderValue() {
    const { request } = this.props;

    const header = getMethodOverrideHeader(request.headers);

    if (header) {
      return header.value;
    }

    // If no override, use GraphQL as override if it's a gql request
    if (request.body && request.body.mimeType === CONTENT_TYPE_GRAPHQL) {
      return 'GQL';
    }

    return null;
  }

  async _debouncedUpdateRenderedUrl(props) {
    clearTimeout(this._urlUpdateInterval);

    this._urlUpdateInterval = setTimeout(() => {
      this._updateRenderedUrl(props);
    }, 300);
  }

  async _updateRenderedUrl(props) {
    let renderedUrl;

    try {
      renderedUrl = await props.handleRender(props.request.url);
    } catch (e) {
      // Certain things, such as invalid variable tags and Prompts
      // without titles will result in a failure to parse. Can't do
      // much else, so let's just give them the unrendered URL
      renderedUrl = props.request.url;
    }

    this.setState({
      renderedUrl,
    });
  }

  setDragDirection(dragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({ dragDirection });
    }
  }

  componentDidMount() {
    const { request } = this.props;
    if (request && !request.name) {
      this._debouncedUpdateRenderedUrl(this.props);
    }
  }

  componentWillUpdate(nextProps) {
    if (!nextProps.request) {
      return;
    }

    const requestUrl = this.props.request ? this.props.request.url : '';
    if (nextProps.request.url !== requestUrl) {
      this._debouncedUpdateRenderedUrl(nextProps);
    }
  }

  componentWillUnmount() {
    clearTimeout(this._urlUpdateInterval);
  }

  render() {
    const {
      filter,
      handleDuplicateRequest,
      handleSetRequestPinned,
      handleGenerateCode,
      handleCopyAsCurl,
      connectDragSource,
      connectDropTarget,
      isDragging,
      isDraggingOver,
      request,
      requestGroup,
      isActive,
      isPinned,
      disableDragAndDrop,
      hotKeyRegistry,
    } = this.props;

    const { dragDirection } = this.state;

    let node;

    const classes = classnames('sidebar__row', {
      'sidebar__row--dragging': isDragging,
      'sidebar__row--dragging-above': isDraggingOver && dragDirection > 0,
      'sidebar__row--dragging-below': isDraggingOver && dragDirection < 0,
    });

    if (!request) {
      node = (
        <li className={classes}>
          <div className="sidebar__item">
            <button className="sidebar__clickable" onClick={this._handleRequestCreateFromEmpty}>
              <em className="faded">click to add first request...</em>
            </button>
          </div>
        </li>
      );
    } else {
      node = (
        <li className={classes}>
          <div
            className={classnames('sidebar__item', 'sidebar__item--request', {
              'sidebar__item--active': isActive,
            })}>
            <button
              className="wide"
              onClick={this._handleRequestActivate}
              onContextMenu={this._handleShowRequestActions}>
              <div className="sidebar__clickable">
                <MethodTag
                  method={request.method}
                  override={this._getMethodOverrideHeaderValue()}
                />
                <Editable
                  value={request.name}
                  fallbackValue={this.state.renderedUrl}
                  blankValue="Empty"
                  className="inline-block"
                  onEditStart={this._handleEditStart}
                  onSubmit={this._handleRequestUpdateName}
                  renderReadView={(value, props) => (
                    <Highlight
                      search={filter}
                      text={value}
                      {...props}
                      title={`${request.name}\n${props.title}`}
                    />
                  )}
                />
              </div>
            </button>
            <div className="sidebar__actions">
              <RequestActionsDropdown
                right
                ref={this._setRequestActionsDropdownRef}
                handleDuplicateRequest={handleDuplicateRequest}
                handleSetRequestPinned={handleSetRequestPinned}
                handleGenerateCode={handleGenerateCode}
                handleCopyAsCurl={handleCopyAsCurl}
                handleShowSettings={this._handleShowRequestSettings}
                request={request}
                isPinned={isPinned}
                requestGroup={requestGroup}
                hotKeyRegistry={hotKeyRegistry}
              />
            </div>
            {isPinned && (
              <div className="sidebar__item__icon-pin">
                <i className="fa fa-thumb-tack" />
              </div>
            )}
          </div>
        </li>
      );
    }

    if (disableDragAndDrop) {
      return node;
    } else if (!this.state.isEditing) {
      return connectDragSource(connectDropTarget(node));
    } else {
      return connectDropTarget(node);
    }
  }
}

SidebarRequestRow.propTypes = {
  // Functions
  handleActivateRequest: PropTypes.func.isRequired,
  handleSetRequestPinned: PropTypes.func.isRequired,
  handleDuplicateRequest: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  handleCopyAsCurl: PropTypes.func.isRequired,
  handleRender: PropTypes.func.isRequired,
  requestCreate: PropTypes.func.isRequired,
  moveDoc: PropTypes.func.isRequired,

  // Other
  filter: PropTypes.string.isRequired,
  isActive: PropTypes.bool.isRequired,
  isPinned: PropTypes.bool.isRequired,
  hotKeyRegistry: PropTypes.object.isRequired,

  // React DnD
  isDragging: PropTypes.bool,
  isDraggingOver: PropTypes.bool,
  connectDragSource: PropTypes.func,
  connectDropTarget: PropTypes.func,

  // Optional
  requestGroup: PropTypes.object,
  request: PropTypes.object,
  disableDragAndDrop: PropTypes.bool,
};

const dragSource = {
  beginDrag(props) {
    return { request: props.request };
  },
};

function isAbove(monitor, component) {
  const hoveredNode = ReactDOM.findDOMNode(component);

  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  const draggedTop = monitor.getSourceClientOffset().y;

  return hoveredTop > draggedTop;
}

const dragTarget = {
  drop(props, monitor, component) {
    const movingDoc = monitor.getItem().requestGroup || monitor.getItem().request;

    const parentId = props.requestGroup ? props.requestGroup._id : props.request.parentId;
    const targetId = props.request ? props.request._id : null;

    if (isAbove(monitor, component)) {
      props.moveDoc(movingDoc, parentId, targetId, 1);
    } else {
      props.moveDoc(movingDoc, parentId, targetId, -1);
    }
  },
  hover(props, monitor, component) {
    if (isAbove(monitor, component)) {
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

const source = DragSource('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(SidebarRequestRow);
export default DropTarget('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);
