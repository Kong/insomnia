import classnames from 'classnames';
import { HotKeyRegistry } from 'insomnia-common';
import React, { FC, forwardRef, MouseEvent, ReactElement, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { DragSource, DragSourceSpec, DropTarget, DropTargetSpec } from 'react-dnd';
import { useSelector } from 'react-redux';

import { CONTENT_TYPE_GRAPHQL } from '../../../common/constants';
import { getMethodOverrideHeader } from '../../../common/misc';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import * as requestOperations from '../../../models/helpers/request-operations';
import { Request } from '../../../models/request';
import { RequestGroup } from '../../../models/request-group';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { createRequest } from '../../hooks/create-request';
import { selectActiveEnvironment, selectActiveProject, selectActiveWorkspace } from '../../redux/selectors';
import { Editable } from '../base/editable';
import { Highlight } from '../base/highlight';
import { RequestActionsDropdown } from '../dropdowns/request-actions-dropdown';
import { GrpcSpinner } from '../grpc-spinner';
import { showModal } from '../modals/index';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';
import { DnDProps, DragObject, dropHandleCreator, hoverHandleCreator, sourceCollect, targetCollect } from './dnd';

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
  handleActivateRequest,
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
}, ref) => {
  const { handleRender } = useNunjucks();
  const activeProject = useSelector(selectActiveProject);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceId = activeWorkspace?._id;
  const [dragDirection, setDragDirection] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const nodeRef = useRef<HTMLLIElement>(null);
  useImperativeHandle(ref, () => ({
    setDragDirection,
    node: nodeRef.current,
  }));

  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  const stopEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const [renderedUrl, setRenderedUrl] = useState('');

  const requestActionsDropdown = useRef<RequestActionsDropdown | null>(null);

  const handleShowRequestActions = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    requestActionsDropdown.current?.show();
  }, [requestActionsDropdown]);

  const handleRequestUpdateName = useCallback((name: string) => {
    if (!request) {
      return;
    }

    requestOperations.update(request, { name }).then(() => {
      stopEditing();
    });
  }, [request, stopEditing]);

  const handleRequestCreateFromEmpty = useCallback(() => {
    if (!requestGroup?._id || !activeWorkspaceId) {
      return;
    }
    createRequest({
      requestType: 'HTTP',
      parentId: requestGroup?._id,
      workspaceId: activeWorkspaceId,
    });
  }, [requestGroup?._id, activeWorkspaceId]);

  const handleRequestActivate = useCallback(() => {
    if (isActive) {
      return;
    }

    handleActivateRequest(request?._id);
  }, [isActive, request?._id, handleActivateRequest]);

  const handleShowRequestSettings = useCallback(() => {
    showModal(RequestSettingsModal, { request });
  }, [request]);

  const [methodOverrideValue, setMethodOverrideValue] = useState<string | null>(null);

  useEffect(() => {
    if (!request) {
      return;
    }

    if (isGrpcRequest(request)) {
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
    const methodTag =
      isGrpcRequest(request) ? (
        <GrpcTag />
      ) : (
        <MethodTag method={request.method} override={methodOverrideValue} />
      );
    node = (
      <li ref={nodeRef} className={classes}>
        <div
          className={classnames('sidebar__item', 'sidebar__item--request', {
            'sidebar__item--active': isActive,
          })}
        >
          <button
            className="wide"
            onClick={handleRequestActivate}
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
              <GrpcSpinner requestId={request._id} className="margin-right-sm" />
            </div>
          </button>
          <div className="sidebar__actions">
            <RequestActionsDropdown
              right
              ref={requestActionsDropdown}
              handleDuplicateRequest={handleDuplicateRequest}
              handleSetRequestPinned={handleSetRequestPinned}
              handleGenerateCode={handleGenerateCode}
              handleCopyAsCurl={handleCopyAsCurl}
              handleShowSettings={handleShowRequestSettings}
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
  } else if (!isEditing) {
    return connectDragSource(connectDropTarget(node));
  } else {
    return connectDropTarget(node);
  }
});

_SidebarRequestRow.displayName = 'SidebarRequestRow';

const source = DragSource('SIDEBAR_REQUEST_ROW', dragSource, sourceCollect)(_SidebarRequestRow);
export const SidebarRequestRow = DropTarget('SIDEBAR_REQUEST_ROW', dragTarget, targetCollect)(source);
