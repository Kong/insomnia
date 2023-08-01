import classnames from 'classnames';
import React, { FC, forwardRef, MouseEvent, ReactElement, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DragSource, DragSourceSpec, DropTarget, DropTargetSpec } from 'react-dnd';
import { useRouteLoaderData } from 'react-router-dom';
import { useFetcher, useNavigate, useParams } from 'react-router-dom';

import { CONTENT_TYPE_GRAPHQL } from '../../../common/constants';
import { getMethodOverrideHeader } from '../../../common/misc';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isEventStreamRequest, isRequest, Request } from '../../../models/request';
import { RequestGroup } from '../../../models/request-group';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { invariant } from '../../../utils/invariant';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { useReadyState } from '../../hooks/use-ready-state';
import { useRequestPatcher } from '../../hooks/use-request';
import { WorkspaceLoaderData } from '../../routes/workspace';
import type { DropdownHandle } from '../base/dropdown';
import { Editable } from '../base/editable';
import { Highlight } from '../base/highlight';
import { RequestActionsDropdown } from '../dropdowns/request-actions-dropdown';
import { WebSocketRequestActionsDropdown } from '../dropdowns/websocket-request-actions-dropdown';
import { showPrompt } from '../modals/index';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';
import { WebSocketTag } from '../tags/websocket-tag';
import { ConnectionCircle } from '../websockets/action-bar';
import { DnDProps, DragObject, dropHandleCreator, hoverHandleCreator, sourceCollect, targetCollect } from './dnd';
interface RawProps {
  disableDragAndDrop?: boolean;
  filter: string;
  isActive: boolean;
  isPinned: boolean;
  request?: Request | GrpcRequest | WebSocketRequest;
  requestGroup?: RequestGroup;
}

type Props = RawProps & DnDProps;

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

export const _SidebarRequestRow: FC<Props> = forwardRef(({
  connectDragSource,
  connectDropTarget,
  disableDragAndDrop,
  filter,
  isActive,
  isDragging,
  isDraggingOver,
  isPinned,
  request,
  requestGroup,
}, ref) => {
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const { handleRender } = useNunjucks();
  const {
    activeEnvironment,
    activeProject,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const patchRequest = useRequestPatcher();

  const [dragDirection, setDragDirection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();
  const handleSetActiveRequest = useCallback(() => {
    invariant(request, 'Request is required');
    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${request._id}`);
  }, [navigate, organizationId, projectId, request, workspaceId]);

  const handleDuplicateRequest = useCallback(() => {
    if (!request) {
      return;
    }

    showPrompt({
      title: 'Duplicate Request',
      defaultValue: request.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: (name: string) => requestFetcher.submit({ name },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${request?._id}/duplicate`,
          method: 'post',
          encType: 'application/json',
        }),
    });
  }, [requestFetcher, organizationId, projectId, request, workspaceId]);

  const nodeRef = useRef<HTMLLIElement>(null);
  useImperativeHandle(ref, () => ({
    setDragDirection,
    node: nodeRef.current,
  }));

  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  const [renderedUrl, setRenderedUrl] = useState('');

  const requestActionsDropdown = useRef<DropdownHandle>(null);

  const handleShowRequestActions = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    requestActionsDropdown.current?.show();
  }, [requestActionsDropdown]);

  const handleRequestUpdateName = useCallback((name?: string) => {
    if (!request || !name) {
      return;
    }
    patchRequest(request._id, { name });
    setIsEditing(false);
  }, [request, patchRequest]);

  const handleRequestCreateFromEmpty = useCallback(() => {
    if (!requestGroup?._id) {
      return;
    }

    requestFetcher.submit({ requestType: 'HTTP', parentId: requestGroup._id },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
        encType: 'application/json',
      });
  }, [requestGroup?._id, requestFetcher, organizationId, projectId, workspaceId]);

  const [isRequestSettingsModalOpen, setIsRequestSettingsModalOpen] = useState(false);

  const [methodOverrideValue, setMethodOverrideValue] = useState<string | null>(null);

  useEffect(() => {
    if (!request) {
      return;
    }

    if (!isRequest(request)) {
      return;
    }

    const header = getMethodOverrideHeader(request.headers);
    if (header) {
      setMethodOverrideValue(header.value);
      return;
    }

    // If no override, use GraphQL as override if it's a GraphQL request
    if (request.body && request.body.mimeType === CONTENT_TYPE_GRAPHQL) {
      setMethodOverrideValue('GQL');
      return;
    }

    setMethodOverrideValue(null);
    return;
  }, [request]);

  useEffect(() => {
    if (!request) {
      return;
    }

    if (isGrpcRequest(request)) {
      return;
    }

    if (request.name) {
      setRenderedUrl(request.name);
      return;
    }

    handleRender(request.url)
      .then(requestUrl => {
        setRenderedUrl(requestUrl);
      })
      .catch(() => {
        // Certain things, such as invalid variable tags and Prompts
        // without titles will result in a failure to parse. Can't do
        // much else, so let's just give them the unrendered URL
        setRenderedUrl(request.url);
      });

  }, [handleRender, request, request?.url]);

  let node: ReactElement<HTMLLIElement> | null = null;
  const classes = classnames('sidebar__row', {
    'sidebar__row--dragging': isDragging,
    'sidebar__row--dragging-above': isDraggingOver && dragDirection > 0,
    'sidebar__row--dragging-below': isDraggingOver && dragDirection < 0,
  });

  if (!request) {
    node = (
      <li ref={nodeRef} className={classes}>
        <div className="sidebar__item">
          <button className="sidebar__clickable" onClick={handleRequestCreateFromEmpty}>
            <em className="faded">click to add first request...</em>
          </button>
        </div>
      </li>
    );
  } else {

    let methodTag;

    if (isGrpcRequest(request)) {
      methodTag = <GrpcTag />;
    } else if (isWebSocketRequest(request)) {
      methodTag = <WebSocketTag />;
    } else if (isEventStreamRequest(request)) {
      methodTag = (<div className="tag tag--no-bg tag--small">
        <span className="tag__inner" style={{ color: 'var(--color-info)' }}>SSE</span>
      </div>);
    } else if (isRequest(request)) {
      methodTag = <MethodTag method={request.method} override={methodOverrideValue} />;
    }

    node = (
      <li ref={nodeRef} className={classes}>
        <div
          className={classnames('sidebar__item', 'sidebar__item--request', {
            'sidebar__item--active': isActive,
          })}
        >
          <button
            className="wide"
            onClick={handleSetActiveRequest}
            onContextMenu={handleShowRequestActions}
          >
            <div className="sidebar__clickable">
              {methodTag}
              <Editable
                value={request.name}
                fallbackValue={renderedUrl}
                blankValue="Empty"
                className="inline-block"
                onEditStart={startEditing}
                onSubmit={handleRequestUpdateName}
                renderReadView={(value, props) => (
                  <Highlight
                    search={filter}
                    text={value}
                    {...props}
                    title={`${request.name}\n${props.title}`}
                  />
                )}
              />
              {isWebSocketRequest(request) && <WebSocketSpinner requestId={request._id} />}
              {isEventStreamRequest(request) && <EventStreamSpinner requestId={request._id} />}
            </div>
          </button>
          <div className="sidebar__actions">
            {isWebSocketRequest(request) ?
              (<WebSocketRequestActionsDropdown
                ref={requestActionsDropdown}
                handleDuplicateRequest={handleDuplicateRequest}
                request={request}
                isPinned={isPinned}
                handleShowSettings={() => setIsRequestSettingsModalOpen(true)}
              />)
              :
              (<RequestActionsDropdown
                ref={requestActionsDropdown}
                handleDuplicateRequest={handleDuplicateRequest}
                handleShowSettings={() => setIsRequestSettingsModalOpen(true)}
                request={request}
                isPinned={isPinned}
                requestGroup={requestGroup}
                activeEnvironment={activeEnvironment}
                activeProject={activeProject}
              />)}
          </div>
          {isRequestSettingsModalOpen && (
            <RequestSettingsModal
              request={request}
              onHide={() => setIsRequestSettingsModalOpen(false)}
            />
          )}
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
  } else if (!isEditing) {
    return connectDragSource(connectDropTarget(node));
  } else {
    return connectDropTarget(node);
  }
});

_SidebarRequestRow.displayName = 'SidebarRequestRow';

const source = DragSource('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(_SidebarRequestRow);
export const SidebarRequestRow = DropTarget('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);

const WebSocketSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'webSocket' });
  return readyState ? <ConnectionCircle data-testid="WebSocketSpinner__Connected" /> : null;
};

const EventStreamSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'curl' });
  return readyState ? <ConnectionCircle data-testid="EventStreamSpinner__Connected" /> : null;
};
