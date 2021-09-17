import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';
import { DragSource, DragSourceSpec, DropTarget, DropTargetSpec } from 'react-dnd';
import { connect } from 'react-redux';

import { AUTOBIND_CFG, CONTENT_TYPE_GRAPHQL } from '../../../common/constants';
import { HotKeyRegistry } from '../../../common/hotkeys';
import { getMethodOverrideHeader } from '../../../common/misc';
import { HandleRender } from '../../../common/render';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import * as requestOperations from '../../../models/helpers/request-operations';
import { Request } from '../../../models/request';
import { RequestGroup } from '../../../models/request-group';
import { RootState } from '../../redux/modules';
import { selectActiveEnvironment, selectActiveProject } from '../../redux/selectors';
import Editable from '../base/editable';
import Highlight from '../base/highlight';
import RequestActionsDropdown from '../dropdowns/request-actions-dropdown';
import GrpcSpinner from '../grpc-spinner';
import { showModal } from '../modals/index';
import RequestSettingsModal from '../modals/request-settings-modal';
import GrpcTag from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';
import { DnDDragProps, DnDDropProps, DnDProps, DragObject, dropHandleCreator, hoverHandleCreator, sourceCollect, targetCollect } from './dnd';

type ReduxProps = ReturnType<typeof mapStateToProps>;

interface Props extends DnDProps, ReduxProps {
  handleActivateRequest: Function;
  handleSetRequestPinned: Function;
  handleDuplicateRequest: Function;
  handleGenerateCode: Function;
  handleCopyAsCurl: Function;
  handleRender: HandleRender;
  requestCreate: Function;
  filter: string;
  isActive: boolean;
  isPinned: boolean;
  hotKeyRegistry: HotKeyRegistry;
  requestGroup?: RequestGroup;
  /** can be Request or GrpcRequest */
  request?: Request | GrpcRequest;
  disableDragAndDrop?: boolean;
}

interface State {
  dragDirection: number;
  isEditing: boolean;
  renderedUrl: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class UnconnectedSidebarRequestRow extends PureComponent<Props, State> {
  state: State = {
    dragDirection: 0,
    isEditing: false,
    renderedUrl: '',
  };

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
    // @ts-expect-error -- TSCONVERSION skip this if request is undefined
    await requestOperations.update(request, patch);
    this.setState({
      isEditing: false,
    });
  }

  _handleRequestCreateFromEmpty() {
    const parentId = this.props.requestGroup?._id;
    this.props.requestCreate(parentId);
  }

  _handleRequestActivate() {
    const { isActive, request, handleActivateRequest } = this.props;

    if (isActive) {
      return;
    }

    // @ts-expect-error -- TSCONVERSION skip this if request is undefined
    handleActivateRequest(request._id);
  }

  _handleShowRequestSettings() {
    showModal(RequestSettingsModal, {
      request: this.props.request,
    });
  }

  _getMethodOverrideHeaderValue() {
    const { request } = this.props;
    // @ts-expect-error -- TSCONVERSION skip this if request is undefined or grpc
    const header = getMethodOverrideHeader(request.headers);

    if (header) {
      return header.value;
    }

    // If no override, use GraphQL as override if it's a gql request
    // @ts-expect-error -- TSCONVERSION skip this if request is undefined or grpc
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
      // @ts-expect-error -- TSCONVERSION skip this if request is undefined or grpc
      renderedUrl = await props.handleRender(props.request.url);
    } catch (e) {
      // Certain things, such as invalid variable tags and Prompts
      // without titles will result in a failure to parse. Can't do
      // much else, so let's just give them the unrendered URL
      // @ts-expect-error -- TSCONVERSION skip this if request is undefined
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
      activeProject,
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
        isGrpcRequest(request) ? (
          <GrpcTag />
        ) : (
          <MethodTag method={request.method} override={this._getMethodOverrideHeaderValue()} />
        );
      node = (
        <li className={classes}>
          <div
            className={classnames('sidebar__item', 'sidebar__item--request', {
              'sidebar__item--active': isActive,
            })}
          >
            <button
              className="wide"
              onClick={this._handleRequestActivate}
              onContextMenu={this._handleShowRequestActions}
            >
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
                activeProject={activeProject}
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

const dragSource: DragSourceSpec<Props, DragObject> = {
  beginDrag(props) {
    return {
      item: props.request,
    };
  },
};

const dropHandle = dropHandleCreator<Props>({
  getParentId: props => props.requestGroup?._id || props.request?.parentId,
  getTargetId: props => props.request?._id,
});

const hoverHandle = hoverHandleCreator<Props>();

const dragTarget: DropTargetSpec<Props> = {
  drop: dropHandle,
  hover: hoverHandle,
};

const mapStateToProps = (state: RootState) => ({
  activeProject: selectActiveProject(state),
  activeEnvironment: selectActiveEnvironment(state),
});

const source = DragSource<Props, DnDDragProps, DragObject>('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(UnconnectedSidebarRequestRow);
const target = DropTarget<Props, DnDDropProps>('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);
const connected = connect(mapStateToProps)(target);

export const SidebarRequestRow = connected;
