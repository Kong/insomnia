import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { HotKeyRegistry } from 'insomnia-common';
import React, { createRef, FC, MouseEvent, PureComponent } from 'react';
import { DragSource, DragSourceSpec, DropTarget, DropTargetSpec } from 'react-dnd';
import { useSelector } from 'react-redux';

import { AUTOBIND_CFG, CONTENT_TYPE_GRAPHQL } from '../../../common/constants';
import { useCreateRequest } from '../../../common/create-request';
import { getMethodOverrideHeader } from '../../../common/misc';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import * as requestOperations from '../../../models/helpers/request-operations';
import { Request } from '../../../models/request';
import { RequestGroup } from '../../../models/request-group';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { selectActiveEnvironment, selectActiveProject } from '../../redux/selectors';
import { Editable } from '../base/editable';
import { Highlight } from '../base/highlight';
import { RequestActionsDropdown } from '../dropdowns/request-actions-dropdown';
import { GrpcSpinner } from '../grpc-spinner';
import { showModal } from '../modals/index';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';
import { DnDProps, DragObject, dropHandleCreator, hoverHandleCreator, sourceCollect, targetCollect } from './dnd';

type DerivedProps = ReturnType<typeof useDerivedProps>;

interface RawProps {
  handleActivateRequest: Function;
  handleSetRequestPinned: Function;
  handleDuplicateRequest: Function;
  handleGenerateCode: Function;
  handleCopyAsCurl: Function;
  filter: string;
  isActive: boolean;
  isPinned: boolean;
  hotKeyRegistry: HotKeyRegistry;
  requestGroup?: RequestGroup;
  /** can be Request or GrpcRequest */
  request?: Request | GrpcRequest;
  disableDragAndDrop?: boolean;
}

type Props = RawProps & DnDProps & DerivedProps;

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

  requestActionsDropdown = createRef<RequestActionsDropdown>();

  _handleShowRequestActions(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    this.requestActionsDropdown.current?.show();
  }

  startEditing() {
    this.setState({ isEditing: true });
  }

  stopEditing() {
    this.setState({ isEditing: false });
  }

  async _handleRequestUpdateName(name: string) {
    const { request } = this.props;
    if (!request) {
      return;
    }

    await requestOperations.update(request, { name });
    this.stopEditing();
  }

  _handleRequestCreateFromEmpty() {
    const parentId = this.props.requestGroup?._id;
    useCreateRequest(parentId, 'HTTP');
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
    const { request } = this.props;
    showModal(RequestSettingsModal, { request });
  }

  _getMethodOverrideHeaderValue() {
    const { request } = this.props;
    if (!request) {
      return;
    }

    if (isGrpcRequest(request)) {
      return;
    }

    const header = getMethodOverrideHeader(request.headers);
    if (header) {
      return header.value;
    }

    // If no override, use GraphQL as override if it's a GraphQL request
    if (request.body && request.body.mimeType === CONTENT_TYPE_GRAPHQL) {
      return 'GQL';
    }

    return null;
  }

  async _updateRenderedUrl(props: Props) {
    let renderedUrl;

    try {
      // @ts-expect-error -- TSCONVERSION skip this if request is undefined or grpc
      renderedUrl = await props.handleRender(props.request.url);
    } catch (error) {
      // Certain things, such as invalid variable tags and Prompts
      // without titles will result in a failure to parse. Can't do
      // much else, so let's just give them the unrendered URL
      // @ts-expect-error -- TSCONVERSION skip this if request is undefined
      renderedUrl = props.request.url;
    }

    this.setState({ renderedUrl });
  }

  setDragDirection(dragDirection: number) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({ dragDirection });
    }
  }

  componentDidMount() {
    const { request } = this.props;

    if (request && !request.name) {
      this._updateRenderedUrl(this.props);
    }
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillUpdate(nextProps: Props) {
    if (!nextProps.request) {
      return;
    }

    const requestUrl = this.props.request ? this.props.request.url : '';

    if (nextProps.request.url !== requestUrl) {
      this._updateRenderedUrl(nextProps);
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
                  onEditStart={this.startEditing}
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
                ref={this.requestActionsDropdown}
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
  beginDrag({ request }) {
    return {
      item: request,
    };
  },
};

const dragTarget: DropTargetSpec<Props> = {
  drop: dropHandleCreator<Props>({
    getParentId: props => props.requestGroup?._id || props.request?.parentId,
    getTargetId: props => props.request?._id,
  }),
  hover: hoverHandleCreator<Props>(),
};

const source = DragSource('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(UnconnectedSidebarRequestRow);
const Target = DropTarget('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);

const useDerivedProps = () => {
  const { handleRender } = useNunjucks();
  const activeProject = useSelector(selectActiveProject);
  const activeEnvironment = useSelector(selectActiveEnvironment);

  return {
    handleRender,
    activeProject,
    activeEnvironment,
  };
};

export const SidebarRequestRow: FC<RawProps> = props => {
  const derivedProps = useDerivedProps();
  return <Target {...props} {...derivedProps} />;
};
