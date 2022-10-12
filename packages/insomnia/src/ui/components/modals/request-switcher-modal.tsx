import classnames from 'classnames';
import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';
import React, { forwardRef, Fragment, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { METHOD_GRPC } from '../../../common/constants';
import { fuzzyMatchAll } from '../../../common/misc';
import * as models from '../../../models';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { Workspace } from '../../../models/workspace';
import { updateRequestMetaByParentId } from '../../hooks/create-request';
import { activateWorkspace } from '../../redux/modules/workspace';
import { selectActiveRequest, selectActiveWorkspace, selectActiveWorkspaceMeta, selectGrpcRequestMetas, selectRequestMetas, selectWorkspaceRequestsAndRequestGroups, selectWorkspacesForActiveProject } from '../../redux/selectors';
import { Highlight } from '../base/highlight';
import { Modal, ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { createKeybindingsHandler, useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';
import { WebSocketTag } from '../tags/websocket-tag';
import { wrapToIndex } from './utils';

interface State {
  searchString: string;
  workspacesForActiveProject: Workspace[];
  matchedRequests: (Request | WebSocketRequest | GrpcRequest)[];
  matchedWorkspaces: Workspace[];
  activeIndex: number;
  maxRequests: number;
  maxWorkspaces: number;
  disableInput: boolean;
  selectOnKeyup: boolean;
  hideNeverActiveRequests: boolean;
  isModalVisible: boolean;
  title: string | null;
}
interface RequestSwitcherModalOptions {
  maxRequests?: number;
  maxWorkspaces?: number;
  disableInput?: boolean;
  selectOnKeyup?: boolean;
  hideNeverActiveRequests?: boolean;
  title?: string;
  openDelay?: number;
}
export interface RequestSwitcherModalHandle {
  show: (options?: RequestSwitcherModalOptions) => void;
  hide: () => void;
}
export const RequestSwitcherModal = forwardRef<RequestSwitcherModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    searchString: '',
    workspacesForActiveProject: [],
    matchedRequests: [],
    matchedWorkspaces: [],
    activeIndex: -1,
    maxRequests: 20,
    maxWorkspaces: 20,
    disableInput: false,
    selectOnKeyup: false,
    hideNeverActiveRequests: false,
    isModalVisible: true,
    title: null,
  });
  const dispatch = useDispatch();
  const activeRequest = useSelector(selectActiveRequest);
  const workspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);
  const requestMetas = useSelector(selectRequestMetas);
  const grpcRequestMetas = useSelector(selectGrpcRequestMetas);
  const workspaceRequestsAndRequestGroups = useSelector(selectWorkspaceRequestsAndRequestGroups);

  /** Return array of path segments for given folders */
  const pathSegments = useCallback((requestOrRequestGroup: Request | WebSocketRequest | GrpcRequest | RequestGroup): string[] => {
    const folders = workspaceRequestsAndRequestGroups.filter(isRequestGroup)
      .filter(g => g._id === requestOrRequestGroup.parentId);
    const folderName = isRequestGroup(requestOrRequestGroup) ? `${requestOrRequestGroup.name}` : '';
    // It's the final parent
    if (folders.length === 0) {
      return [folderName];
    }
    // Still has more parents
    if (folderName) {
      return [...pathSegments(folders[0]), folderName];
    }
    // It's the child
    return pathSegments(folders[0]);
  }, [workspaceRequestsAndRequestGroups]);
  const getLastActiveRequestMap = useCallback(() => {
    // requestIds: lastActive datetime
    const lastActiveMap: Record<string, number> = {};

    for (const meta of requestMetas) {
      lastActiveMap[meta.parentId] = meta.lastActive;
    }
    for (const meta of grpcRequestMetas) {
      lastActiveMap[meta.parentId] = meta.lastActive;
    }
    return lastActiveMap;
  }, [grpcRequestMetas, requestMetas]);

  const isMatch = useCallback((request: Request | WebSocketRequest | GrpcRequest, searchStrings: string): number | null => {
    if (request._id === searchStrings) {
      return Infinity;
    }
    // name
    const searchIndexes = [request.name];
    // url
    isGrpcRequest(request) ? searchIndexes.push(request.url + request.protoMethodName)
      : searchIndexes.push(joinUrlAndQueryString(request.url, buildQueryStringFromParams(request.parameters)));
    // http method
    const method = isRequest(request) && request.method;
    method && searchIndexes.push(method);
    isGrpcRequest(request) && searchIndexes.push(METHOD_GRPC);
    // path segments
    searchIndexes.push(pathSegments(request).join('/'));
    const match = fuzzyMatchAll(
      searchStrings,
      searchIndexes,
      { splitSpace: true },
    );
    if (!match) {
      return null;
    }
    return match.score;
  }, [pathSegments]);
  const handleChangeValue = useCallback((searchString: string) => {
    const { maxRequests, maxWorkspaces, hideNeverActiveRequests } = state;
    const lastActiveMap = getLastActiveRequestMap();

    // OPTIMIZATION: This only filters if we have a filter
    let matchedRequests = (workspaceRequestsAndRequestGroups
      .filter(child => isRequest(child) || isWebSocketRequest(child) || isGrpcRequest(child)) as (Request | WebSocketRequest | GrpcRequest)[])
      .sort((a, b) => {
        const aLA = lastActiveMap[a._id] || 0;
        const bLA = lastActiveMap[b._id] || 0;
        // If lastActive same, go by name
        if (aLA === bLA) {
          return a.name > b.name ? 1 : -1;
        }
        return bLA - aLA;
      });

    if (hideNeverActiveRequests) {
      matchedRequests = matchedRequests.filter(r => lastActiveMap[r._id]);
    }

    if (searchString) {
      matchedRequests = matchedRequests
        .map(r => ({
          request: r,
          score: isMatch(r, searchString),
        }))
        .filter(v => v.score !== null)
        .sort((a, b) => Number(a.score || -Infinity) - Number(b.score || -Infinity))
        .map(v => v.request);
    }

    const matchedWorkspaces = workspacesForActiveProject
      .filter(w => w._id !== workspace?._id)
      .filter(w => {
        const name = w.name.toLowerCase();
        const toMatch = searchString.toLowerCase();
        return name.indexOf(toMatch) !== -1;
      });
    // Make sure we select the first item but we don't want to select the currently active
    // one because that wouldn't make any sense.
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    const indexOfFirstNonActiveRequest = matchedRequests.findIndex(r => r._id !== activeRequestId);
    setState(state => ({
      ...state,
      searchString,
      activeIndex: indexOfFirstNonActiveRequest >= 0 ? indexOfFirstNonActiveRequest : 0,
      matchedRequests: matchedRequests.slice(0, maxRequests),
      matchedWorkspaces: matchedWorkspaces.slice(0, maxWorkspaces),
    }));
  }, [state, getLastActiveRequestMap, workspaceRequestsAndRequestGroups, workspacesForActiveProject, activeRequest, isMatch, workspace?._id]);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      if (modalRef.current?.isOpen()) {
        return;
      }

      setState(state => ({
        ...state,
        maxRequests: options?.maxRequests ?? 20,
        maxWorkspaces: options?.maxWorkspaces ?? 20,
        disableInput: !!options?.disableInput,
        hideNeverActiveRequests: !!options?.hideNeverActiveRequests,
        selectOnKeyup: !!options?.selectOnKeyup,
        title: options?.title || null,
        isModalVisible: true,
      }));
      handleChangeValue('');
      modalRef.current?.show();
    },
  }), [handleChangeValue]);

  const activateWorkspaceAndHide = useCallback((workspace?: Workspace) => {
    if (!workspace) {
      return;
    }
    dispatch(activateWorkspace({ workspace }));
    modalRef.current?.hide();
  }, [dispatch]);

  const activateRequestAndHide = useCallback((request?: Request | WebSocketRequest | GrpcRequest) => {
    if (!request) {
      return;
    }
    if (activeWorkspaceMeta) {
      models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: request._id });
    }
    updateRequestMetaByParentId(request._id, { lastActive: Date.now() });
    modalRef.current?.hide();
  }, [activeWorkspaceMeta]);

  const activateCurrentIndex = useCallback(async () => {
    const { activeIndex, matchedRequests, matchedWorkspaces, searchString } = state;
    if (activeIndex < matchedRequests.length) {
      // Activate the request if there is one
      const request = matchedRequests[activeIndex];
      activateRequestAndHide(request);
      return;
    }
    if (activeIndex < matchedRequests.length + matchedWorkspaces.length) {
      // Activate the workspace if there is one
      const index = activeIndex - matchedRequests.length;
      const workspace = matchedWorkspaces[index];
      if (workspace) {
        activateWorkspaceAndHide(workspace);
      }
      return;
    }
    if (searchString) {
      // Create request if no match
      if (!workspace) {
        return;
      }

      // Create the request if nothing matched
      const request = await models.request.create({
        parentId: activeRequest ? activeRequest.parentId : workspace._id,
        name: state.searchString,
      });

      activateRequestAndHide(request);
    }
  }, [activateRequestAndHide, activateWorkspaceAndHide, activeRequest, state, workspace]);

  const handleInputKeydown = createKeybindingsHandler({
    'ArrowUp': e => {
      e.preventDefault();
      setState(state => ({
        ...state,
        activeIndex: wrapToIndex(state.activeIndex - 1, state.matchedRequests.length + state.matchedWorkspaces.length),
      }));
    },
    'Shift+Tab': e => {
      e.preventDefault();
      setState(state => ({
        ...state,
        activeIndex: wrapToIndex(state.activeIndex - 1, state.matchedRequests.length + state.matchedWorkspaces.length),
      }));
    },
    'ArrowDown': e => {
      e.preventDefault();
      setState(state => ({
        ...state,
        activeIndex: wrapToIndex(state.activeIndex + 1, state.matchedRequests.length + state.matchedWorkspaces.length),
      }));
    },
    'Tab': e => {
      e.preventDefault();
      setState(state => ({
        ...state,
        activeIndex: wrapToIndex(state.activeIndex + 1, state.matchedRequests.length + state.matchedWorkspaces.length),
      }));
    },
    'Enter': e => {
      e.preventDefault();
      activateCurrentIndex();
    },
  });

  useDocBodyKeyboardShortcuts({
    request_showRecent: () => {
      if (state.isModalVisible) {
        setState(state => ({
          ...state,
          activeIndex: wrapToIndex(state.activeIndex + 1, state.matchedRequests.length + state.matchedWorkspaces.length),
        }));
      }
    },
    request_showRecentPrevious: () => {
      if (state.isModalVisible) {
        setState(state => ({
          ...state,
          activeIndex: wrapToIndex(state.activeIndex - 1, state.matchedRequests.length + state.matchedWorkspaces.length),
        }));
      }
    },
  });

  useEffect(() => {
    const handleKeyup = async (event: KeyboardEvent) => {
      // Handle selection if unpresses all modifier keys. Ideally this would trigger once
      // the user unpresses the hotkey that triggered this modal but we currently do not
      // have the facilities to do that.
      const isMetaKeyDown = event.ctrlKey || event.shiftKey || event.metaKey || event.altKey;

      if (state.selectOnKeyup && modalRef.current?.isOpen() && !isMetaKeyDown) {
        await activateCurrentIndex();
        modalRef.current?.hide();
      }
    };

    document.body.addEventListener('keyup', handleKeyup);

    return () => {
      document.body.removeEventListener('keyup', handleKeyup);
    };
  }, [activateCurrentIndex, state.selectOnKeyup]);

  const {
    searchString,
    activeIndex,
    matchedRequests,
    matchedWorkspaces,
    disableInput,
    title,
    isModalVisible,
  } = state;
  const requestGroups = workspaceRequestsAndRequestGroups.filter(isRequestGroup);
  return (
    <Modal
      ref={modalRef}
      className={isModalVisible ? '' : 'hide'}
    >
      <ModalHeader hideCloseButton>
        {title || (
          <Fragment>
            <div className="pull-right txt-sm pad-right tall">
              <span className="vertically-center">
                <div>
                  <span className="monospace">tab</span> or&nbsp;
                  <span className="monospace">↑↓</span> to navigate&nbsp;&nbsp;&nbsp;&nbsp;
                  <span className="monospace">↵</span> &nbsp;to select&nbsp;&nbsp;&nbsp;&nbsp;
                  <span className="monospace">esc</span> to dismiss
                </div>
              </span>
            </div>
            <div>Quick Switch</div>
          </Fragment>
        )}
      </ModalHeader>
      <ModalBody className="request-switcher">
        {!disableInput && (
          <div className="pad" onKeyDown={handleInputKeydown}>
            <div className="form-control form-control--outlined no-margin">
              <input
                type="text"
                autoFocus
                placeholder="Filter by name or folder"
                value={searchString}
                onChange={event => handleChangeValue(event.currentTarget.value)}
              />
            </div>
          </div>
        )}
        <ul>
          {matchedRequests.map((r: Request | WebSocketRequest | GrpcRequest, i) => {
            const requestGroup = requestGroups.find(rg => rg._id === r.parentId);
            const buttonClasses = classnames(
              'btn btn--expandable-small wide text-left pad-bottom',
              {
                focus: activeIndex === i,
              },
            );
            return (
              <li key={r._id}>
                <button onClick={() => activateRequestAndHide(r)} className={buttonClasses}>
                  <div>
                    {requestGroup ? (
                      <div className="pull-right faint italic">
                        <Highlight search={searchString} text={pathSegments(r).join(' / ')} />
                          &nbsp;&nbsp;
                        <i className="fa fa-folder-o" />
                      </div>
                    ) : null}
                    <Highlight search={searchString} text={r.name} />
                  </div>
                  <div className="margin-left-xs faint">
                    {isRequest(r) ? <MethodTag method={r.method} /> : null}
                    {isGrpcRequest(r) ? <GrpcTag /> : null}
                    {isWebSocketRequest(r) ? <WebSocketTag /> : null}
                    {<Highlight search={searchString} text={isGrpcRequest(r) ? r.url + r.protoMethodName : r.url} />}
                  </div>
                </button>
              </li>
            );
          })}

          {matchedRequests.length > 0 && matchedWorkspaces.length > 0 && (
            <li className="pad-left pad-right">
              <hr />
            </li>
          )}

          {matchedWorkspaces.map((w, i) => {
            const buttonClasses = classnames('btn btn--super-compact wide text-left', {
              focus: activeIndex - matchedRequests.length === i,
            });
            return (
              <li key={w._id}>
                <button onClick={() => activateWorkspaceAndHide(w)} className={buttonClasses}>
                  <i className="fa fa-random" />
                    &nbsp;&nbsp;&nbsp; Switch to <strong>{w.name}</strong>
                </button>
              </li>
            );
          })}
        </ul>

        {searchString && matchedRequests.length === 0 && matchedWorkspaces.length === 0 && (
          <div className="text-center pad-bottom">
            <p>
              No matches found for <strong>{searchString}</strong>
            </p>

            {workspace ? <button
              className="btn btn--outlined btn--compact"
              disabled={!searchString}
              onClick={activateCurrentIndex}
            >
              Create a request named {searchString}
            </button> : null}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
});
RequestSwitcherModal.displayName = 'RequestSwitcherModal';
