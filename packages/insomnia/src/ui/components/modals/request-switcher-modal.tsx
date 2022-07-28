import classnames from 'classnames';
import { buildQueryStringFromParams, joinUrlAndQueryString } from 'insomnia-url';
import React, { forwardRef, Fragment, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { METHOD_GRPC } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { isEventKey, keyboardKeys } from '../../../common/keyboard-keys';
import { fuzzyMatchAll } from '../../../common/misc';
import * as models from '../../../models';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import { Workspace } from '../../../models/workspace';
import { activateWorkspace } from '../../redux/modules/workspace';
import { selectActiveRequest, selectActiveWorkspace, selectGrpcRequestMetas, selectRequestMetas, selectWorkspaceRequestsAndRequestGroups, selectWorkspacesForActiveProject } from '../../redux/selectors';
import { Button } from '../base/button';
import { Highlight } from '../base/highlight';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { KeydownBinder } from '../keydown-binder';
import { GrpcTag } from '../tags/grpc-tag';
import { MethodTag } from '../tags/method-tag';
import { wrapToIndex } from './utils';

interface Props {
  activateRequest: (id: string) => void;
}
interface State {
  searchString: string;
  workspacesForActiveProject: Workspace[];
  matchedRequests: (Request | GrpcRequest)[];
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
  show: (options: RequestSwitcherModalOptions) => void;
  hide: () => void;
}
export const RequestSwitcherModal = forwardRef<RequestSwitcherModalHandle, ModalProps & Props>(({ activateRequest }, ref) => {
  const modalRef = useRef<Modal>(null);
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
  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);
  const requestMetas = useSelector(selectRequestMetas);
  const grpcRequestMetas = useSelector(selectGrpcRequestMetas);
  const workspaceRequestsAndRequestGroups = useSelector(selectWorkspaceRequestsAndRequestGroups);

  /** Return array of path segments for given request or folder */
  const groupOf = useCallback((requestOrRequestGroup: Request | GrpcRequest | RequestGroup): string[] => {
    const requestGroups = workspaceRequestsAndRequestGroups.filter(isRequestGroup);
    const matchedGroups = requestGroups.filter(g => g._id === requestOrRequestGroup.parentId);
    const currentGroupName = isRequestGroup(requestOrRequestGroup) ? `${requestOrRequestGroup.name}` : '';
    // It's the final parent
    if (matchedGroups.length === 0) {
      return [currentGroupName];
    }
    // Still has more parents
    if (currentGroupName) {
      return [...groupOf(matchedGroups[0]), currentGroupName];
    }
    // It's the child
    return groupOf(matchedGroups[0]);
  }, [workspaceRequestsAndRequestGroups]);

  const handleChangeValue = useCallback((searchString: string) => {
    const { maxRequests, maxWorkspaces, hideNeverActiveRequests } = state;
    const lastActiveMap: Record<string, number> = {};

    for (const meta of requestMetas) {
      lastActiveMap[meta.parentId] = meta.lastActive;
    }
    for (const meta of grpcRequestMetas) {
      lastActiveMap[meta.parentId] = meta.lastActive;
    }

    // OPTIMIZATION: This only filters if we have a filter
    let matchedRequests = (workspaceRequestsAndRequestGroups
      .filter(child => isRequest(child) || isGrpcRequest(child)) as (Request | GrpcRequest)[])
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
        .map(request => ({
          request,
          score: () => {
            let finalUrl = request.url;
            let method = '';
            if (isRequest(request)) {
              finalUrl = joinUrlAndQueryString(finalUrl, buildQueryStringFromParams(request.parameters));
              method = request.method;
            }
            if (isGrpcRequest(request)) {
              finalUrl = request.url + request.protoMethodName;
              method = METHOD_GRPC;
            }
            const match = fuzzyMatchAll(
              searchString,
              [request.name, finalUrl, method, groupOf(request).join('/')],
              {
                splitSpace: true,
              },
            );
            // Match exact Id
            const matchesId = request._id === searchString;
            // _id match is the highest;
            if (matchesId) {
              return Infinity;
            }
            if (!match) {
              return null;
            }
            return match.score;
          },
        }))
        .filter(v => v.score !== null)
        .sort((a, b) => (a.score || -Infinity) - (b.score || -Infinity))
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
    setState({
      ...state,
      searchString,
      activeIndex: indexOfFirstNonActiveRequest >= 0 ? indexOfFirstNonActiveRequest : 0,
      matchedRequests: matchedRequests.slice(0, maxRequests),
      matchedWorkspaces: matchedWorkspaces.slice(0, maxWorkspaces),
    });
  }, [activeRequest, groupOf, grpcRequestMetas, requestMetas, state, workspace?._id, workspaceRequestsAndRequestGroups, workspacesForActiveProject]);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      if (modalRef.current?.isOpen()) {
        return;
      }

      setState({
        ...state,
        maxRequests: typeof options.maxRequests === 'number' ? options.maxRequests : 20,
        maxWorkspaces: typeof options.maxWorkspaces === 'number' ? options.maxWorkspaces : 20,
        disableInput: !!options.disableInput,
        hideNeverActiveRequests: !!options.hideNeverActiveRequests,
        selectOnKeyup: !!options.selectOnKeyup,
        title: options.title || null,
        isModalVisible: false,
      });
      handleChangeValue('');
      modalRef.current?.show();
    },
  }), [handleChangeValue, state]);

  const _setActiveIndex = (activeIndex: number) => {
    const maxIndex = state.matchedRequests.length + state.matchedWorkspaces.length;
    setState({
      ...state,
      activeIndex: wrapToIndex(activeIndex, maxIndex),
    });
  };

  const activateWorkspaceAndHide = (workspace?: Workspace) => {
    if (!workspace) {
      return;
    }
    dispatch(activateWorkspace({ workspace }));
    modalRef.current?.hide();
  };
  const activateRequestAndHide = (request?: Request | GrpcRequest) => {
    if (!request) {
      return;
    }
    activateRequest(request._id);
    modalRef.current?.hide();
  };
  const createRequestFromSearch = async () => {
    const { searchString } = state;

    if (!workspace) {
      return;
    }

    // Create the request if nothing matched
    const parentId = activeRequest ? activeRequest.parentId : workspace._id;
    const patch = {
      parentId,
      name: searchString,
    };
    const request = await models.request.create(patch);

    activateRequestAndHide(request);
  };
  const activateCurrentIndex = async () => {
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
      await createRequestFromSearch();
    }
  };

  const handleInputKeydown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const isKey = isEventKey(event as unknown as KeyboardEvent);
    if (isKey('uparrow') || (isKey('tab') && event.shiftKey)) {
      _setActiveIndex(state.activeIndex - 1);
    } else if (isKey('downarrow') || isKey('tab')) {
      _setActiveIndex(state.activeIndex + 1);
    } else if (isKey('enter')) {
      activateCurrentIndex();
    } else {
      return;
    }
    event.preventDefault();
  };
  const handleKeydown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.keyCode === keyboardKeys.esc.keyCode) {
      modalRef.current?.hide();
      return;
    }

    // Only control up/down with tab if modal is visible
    executeHotKey(event as unknown as KeyboardEvent, hotKeyRefs.SHOW_RECENT_REQUESTS, () => {
      if (state.isModalVisible) {
        _setActiveIndex(state.activeIndex + 1);
      }
    });
    // Only control up/down with tab if modal is visible
    executeHotKey(event as unknown as KeyboardEvent, hotKeyRefs.SHOW_RECENT_REQUESTS_PREVIOUS, () => {
      if (state.isModalVisible) {
        _setActiveIndex(state.activeIndex - 1);
      }
    });
  };

  const handleKeyup = async (event: KeyboardEvent) => {
    const { selectOnKeyup } = state;
    // Handle selection if unpresses all modifier keys. Ideally this would trigger once
    // the user unpresses the hotkey that triggered this modal but we currently do not
    // have the facilities to do that.
    const isMetaKeyDown = event.ctrlKey || event.shiftKey || event.metaKey || event.altKey;
    const isActive = modalRef.current?.isOpen();

    if (selectOnKeyup && isActive && !isMetaKeyDown) {
      await activateCurrentIndex();
      modalRef.current?.hide();
    }
  };

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
    <KeydownBinder onKeydown={handleKeydown} onKeyup={handleKeyup}>
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
                  placeholder="Filter by name or folder"
                  value={searchString}
                  onChange={event => handleChangeValue(event.currentTarget.value)}
                />
              </div>
            </div>
          )}
          <ul>
            {matchedRequests.map((r: Request | GrpcRequest, i) => {
              const requestGroup = requestGroups.find(rg => rg._id === r.parentId);
              const buttonClasses = classnames(
                'btn btn--expandable-small wide text-left pad-bottom',
                {
                  focus: activeIndex === i,
                },
              );
              return (
                <li key={r._id}>
                  <Button onClick={(_e, request) => activateRequestAndHide(request)} value={r} className={buttonClasses}>
                    <div>
                      {requestGroup ? (
                        <div className="pull-right faint italic">
                          <Highlight search={searchString} text={groupOf(r).join(' / ')} />
                          &nbsp;&nbsp;
                          <i className="fa fa-folder-o" />
                        </div>
                      ) : null}
                      <Highlight search={searchString} text={r.name} />
                    </div>
                    <div className="margin-left-xs faint">
                      {isRequest(r) ? <MethodTag method={r.method} /> : null}
                      {isGrpcRequest(r) ? <GrpcTag /> : null}
                      {<Highlight search={searchString} text={isGrpcRequest(r) ? r.url + r.protoMethodName : r.url} />}
                    </div>
                  </Button>
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
                  <Button onClick={(_e, value) => activateWorkspaceAndHide(value)} value={w} className={buttonClasses}>
                    <i className="fa fa-random" />
                    &nbsp;&nbsp;&nbsp; Switch to <strong>{w.name}</strong>
                  </Button>
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
    </KeydownBinder>
  );
});
RequestSwitcherModal.displayName = 'RequestSwitcherModal';
