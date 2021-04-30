import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
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
import { CONTENT_TYPE_GRAPHQL, AUTOBIND_CFG } from '../../../common/constants';
import { getMethodOverrideHeader } from '../../../common/misc';
import GrpcTag from '../tags/grpc-tag';
import * as requestOperations from '../../../models/helpers/request-operations';
import GrpcSpinner from '../grpc-spinner';
import { Environment } from '../../../models/environment';

interface Props {
  activeEnvironment: Environment | null;
  handleActivateRequest: Function;
  handleSetRequestPinned: Function;
  handleDuplicateRequest: Function;
  handleGenerateCode: Function;
  handleCopyAsCurl: Function;
  handleRender: Function;
  requestCreate: Function;
  moveDoc: Function;
  filter: string;
  isActive: boolean;
  isPinned: boolean;
  hotKeyRegistry: object;
  isDragging?: boolean;
  isDraggingOver?: boolean;
  connectDragSource?: Function;
  connectDropTarget?: Function;
  requestGroup?: object;
  request?: object;
  /** can be Request or GrpcRequest */
  disableDragAndDrop?: boolean;
}

interface State {
  dragDirection: number;
  isEditing: boolean;
  renderedUrl: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class SidebarRequestRow extends PureComponent<Props, State> {
  state: State = {
    dragDirection: 0,
    isEditing: false,
    renderedUrl: '',
  }

  _urlUpdateInterval: NodeJS.Timeout | null = null;
  _requestActionsDropdown: RequestActionsDropdown | null = null;

  _setRequestActionsDropdownRef(n: RequestActionsDropdown) {
    this._requestActionsDropdown = n;
  }

  _handleShowRequestActions(e) {
    e.preventDefault();

    this._requestActionsDropdown?.show();
  }

  _handleEditStart() {
    this.setState({
      isEditing: true,
    });
  }

  async _handleRequestUpdateName(name) {
    const { request } = this.props;
    const patch = {
      name,
    };
    await requestOperations.update(request, patch);
    this.setState({
      isEditing: false,
    });
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
    showModal(RequestSettingsModal, {
      request: this.props.request,
    });
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

  async _debouncedUpdateRenderedUrl(props: Props) {
    if (this._urlUpdateInterval !== null) {
      clearTimeout(this._urlUpdateInterval);
    }
    this._urlUpdateInterval = setTimeout(() => {
      this._updateRenderedUrl(props);
    }, 300);
  }

  async _updateRenderedUrl(props: Props) {
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
      this.setState({
        dragDirection,
      });
    }
  }

  componentDidMount() {
    const { request } = this.props;

    if (request && !request.name) {
      this._debouncedUpdateRenderedUrl(this.props);
    }
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillUpdate(nextProps) {
    if (!nextProps.request) {
      return;
    }

    const requestUrl = this.props.request ? this.props.request.url : '';

    if (nextProps.request.url !== requestUrl) {
      this._debouncedUpdateRenderedUrl(nextProps);
    }
  }

  componentWillUnmount() {
    if (this._urlUpdateInterval !== null) {
      clearTimeout(this._urlUpdateInterval);
    }
  }

  render() {
    const {
      activeEnvironment,
      connectDragSource,
      connectDropTarget,
      disableDragAndDrop,
      filter,
      handleCopyAsCurl,
      handleDuplicateRequest,
      handleGenerateCode,
      handleSetRequestPinned,
      hotKeyRegistry,
      isActive,
      isDragging,
      isDraggingOver,
      isPinned,
      request,
      requestGroup,
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
      const methodTag =
        request.type === models.grpcRequest.type ? (
          <GrpcTag />
        ) : (
          <MethodTag method={request.method} override={this._getMethodOverrideHeaderValue()} />
        );
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
                {methodTag}
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
                <GrpcSpinner requestId={request._id} className="margin-right-sm" />
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
                hotKeyRegistry={hotKeyRegistry} // Necessary for plugin actions to have network capabilities
                activeEnvironment={activeEnvironment}
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

const dragSource = {
  beginDrag(props: Props) {
    return {
      request: props.request,
    };
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
