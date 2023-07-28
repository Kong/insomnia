import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useFetcher, useParams } from 'react-router-dom';

import { database as db } from '../../../common/database';
import * as models from '../../../models';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { isWorkspace, Workspace } from '../../../models/workspace';
import { invariant } from '../../../utils/invariant';
import { useRequestPatcher } from '../../hooks/use-request';
import { selectWorkspacesForActiveProject } from '../../redux/selectors';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { CodeEditorHandle } from '../codemirror/code-editor';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';

export interface RequestSettingsModalOptions {
  request: Request | GrpcRequest | WebSocketRequest;
  forceEditMode?: boolean;
}
interface State {
  request: Request | GrpcRequest | WebSocketRequest | null;
  showDescription: boolean;
  defaultPreviewMode: boolean;
  activeWorkspaceIdToCopyTo: string | null;
  workspace?: Workspace;
}
export interface RequestSettingsModalHandle {
  show: (options: RequestSettingsModalOptions) => void;
  hide: () => void;
}
export const RequestSettingsModal = forwardRef<RequestSettingsModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const editorRef = useRef<CodeEditorHandle>(null);

  const [state, setState] = useState<State>({
    request: null,
    showDescription: false,
    defaultPreviewMode: false,
    activeWorkspaceIdToCopyTo: null,
    workspace: undefined,
  });
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const patchRequest = useRequestPatcher();
  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async ({ request, forceEditMode }) => {
      const hasDescription = !!request.description;
      // Find this request workspace for filtering out of workspaces list
      const ancestors = await db.withAncestors(request);
      const workspace = workspacesForActiveProject.find(w => w._id === ancestors.find(isWorkspace)?._id);
      setState(state => ({
        ...state,
        request,
        workspace: workspace,
        activeWorkspaceIdToCopyTo: null,
        showDescription: forceEditMode || hasDescription,
        defaultPreviewMode: hasDescription && !forceEditMode,
      }));

      modalRef.current?.show();
    },
  }), [workspacesForActiveProject]);

  const updateRequest = (req: Partial<Request>) => {
    invariant(state.request, 'Request is required');
    patchRequest(state.request._id, req);
  };
  const duplicateRequest = (r: Partial<Request>) => {
    invariant(state.request, 'Request is required');
    requestFetcher.submit(JSON.stringify(r),
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${state.request._id}/duplicate`,
        method: 'post',
        encType: 'application/json',
      });
  };
  async function handleMoveToWorkspace() {
    const { activeWorkspaceIdToCopyTo } = state;
    invariant(activeWorkspaceIdToCopyTo, 'Workspace ID is required');
    updateRequest({ parentId: activeWorkspaceIdToCopyTo });
    modalRef.current?.hide();
  }

  async function handleCopyToWorkspace() {
    const { activeWorkspaceIdToCopyTo } = state;
    invariant(activeWorkspaceIdToCopyTo, 'Workspace ID is required');
    duplicateRequest({ parentId: activeWorkspaceIdToCopyTo });
  }
  const { request, showDescription, defaultPreviewMode, activeWorkspaceIdToCopyTo, workspace } = state;
  const toggleCheckBox = async (event: any) => {
    updateRequest({ [event.currentTarget.name]: event.currentTarget.checked ? true : false });

    const updated = { ...state.request, [event.currentTarget.name]: event.currentTarget.checked } as Request;
    setState(state => ({ ...state, request: updated }));
  };
  const updateDescription = (description: string) => {
    updateRequest({ description });
    const updated = { ...state.request, description } as Request;
    setState({
      ...state,
      request: updated,
      defaultPreviewMode: false,
    });
  };
  const updateName = (name: string) => {
    updateRequest({ name });
    const updated = { ...state.request, name } as Request;
    setState(state => ({
      ...state,
      request: updated,
    }));
  };

  return (
    <Modal ref={modalRef}>
      <ModalHeader>
        Request Settings{' '}
        <span className="txt-sm selectable faint monospace">{request ? request._id : ''}</span>
      </ModalHeader>
      <ModalBody className="pad">
        <div>
          <div className="form-control form-control--outlined">
            <label>
              Name{' '}
              <span className="txt-sm faint italic">(also rename by double-clicking in sidebar)</span>
              <input
                type="text"
                placeholder={request?.url || 'My Request'}
                defaultValue={request?.name}
                onChange={event => updateName(event.target.value)}
              />
            </label>
          </div>
          {request && isWebSocketRequest(request) && (
            <>
              <>
                {showDescription ? (
                  <MarkdownEditor
                    ref={editorRef}
                    className="margin-top"
                    defaultPreviewMode={defaultPreviewMode}
                    placeholder="Write a description"
                    defaultValue={request.description}
                    onChange={updateDescription}
                  />
                ) : (
                  <button
                    onClick={() => setState(state => ({ ...state, showDescription: true }))}
                    className="btn btn--outlined btn--super-duper-compact"
                  >
                    Add Description
                  </button>
                )}
              </>
              <>
                <div className="pad-top pad-bottom">
                  <div className="form-control form-control--thin">
                    <label>
                      Send cookies automatically
                      <input
                        type="checkbox"
                        name="settingSendCookies"
                        checked={request.settingSendCookies}
                        onChange={toggleCheckBox}
                      />
                    </label>
                  </div>
                  <div className="form-control form-control--thin">
                    <label>
                      Store cookies automatically
                      <input
                        type="checkbox"
                        name="settingStoreCookies"
                        checked={request.settingStoreCookies}
                        onChange={toggleCheckBox}
                      />
                    </label>
                  </div>
                </div>
                <div className="form-control form-control--outlined">
                  <label>
                    Follow redirects <span className="txt-sm faint italic">(overrides global setting)</span>
                    <select
                      defaultValue={request.settingFollowRedirects}
                      name="settingFollowRedirects"
                      onChange={toggleCheckBox}
                    >
                      <option value={'global'}>Use global setting</option>
                      <option value={'off'}>Don't follow redirects</option>
                      <option value={'on'}>Follow redirects</option>
                    </select>
                  </label>
                </div>
              </>
              <hr />
              <div className="form-row">
                <div className="form-control form-control--outlined">
                  <label>
                    Move/Copy to Workspace
                    <HelpTooltip position="top" className="space-left">
                      Copy or move the current request to a new workspace. It will be placed at the root of
                      the new workspace's folder structure.
                    </HelpTooltip>
                    <select
                      value={activeWorkspaceIdToCopyTo || '__NULL__'}
                      onChange={event => {
                        const { value } = event.currentTarget;
                        const workspaceId = value === '__NULL__' ? null : value;
                        setState(state => ({ ...state, activeWorkspaceIdToCopyTo: workspaceId }));
                      }}
                    >
                      <option value="__NULL__">-- Select Workspace --</option>
                      {workspacesForActiveProject.map(w => {
                        if (workspace && workspace._id === w._id) {
                          return null;
                        }

                        return (
                          <option key={w._id} value={w._id}>
                            {w.name}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
                <div className="form-control form-control--no-label width-auto">
                  <button
                    disabled={!activeWorkspaceIdToCopyTo}
                    className="btn btn--clicky"
                    onClick={handleCopyToWorkspace}
                  >
                    Copy
                  </button>
                </div>
                <div className="form-control form-control--no-label width-auto">
                  <button
                    disabled={!activeWorkspaceIdToCopyTo}
                    className="btn btn--clicky"
                    onClick={handleMoveToWorkspace}
                  >
                    Move
                  </button>
                </div>
              </div>
            </>)}
          {request && isGrpcRequest(request) && (
            <p className="faint italic">
              Are there any gRPC settings you expect to see? Create a{' '}
              <a href={'https://github.com/Kong/insomnia/issues/new/choose'}>feature request</a>!
            </p>
          )}
          {request && isRequest(request) && (
            <>
              <>
                {showDescription ? (
                  <MarkdownEditor
                    ref={editorRef}
                    className="margin-top"
                    defaultPreviewMode={defaultPreviewMode}
                    placeholder="Write a description"
                    defaultValue={request.description}
                    onChange={updateDescription}
                  />
                ) : (
                  <button
                    onClick={() => setState(state => ({ ...state, showDescription: true }))}
                    className="btn btn--outlined btn--super-duper-compact"
                  >
                    Add Description
                  </button>
                )}
              </>
              <>
                <div className="pad-top pad-bottom">
                  <div className="form-control form-control--thin">
                    <label>
                      Send cookies automatically
                      <input
                        type="checkbox"
                        name="settingSendCookies"
                        checked={request.settingSendCookies}
                        onChange={toggleCheckBox}
                      />
                    </label>
                  </div>
                  <div className="form-control form-control--thin">
                    <label>
                      Store cookies automatically
                      <input
                        type="checkbox"
                        name="settingStoreCookies"
                        checked={request.settingStoreCookies}
                        onChange={toggleCheckBox}
                      />
                    </label>
                  </div>
                  <div className="form-control form-control--thin">
                    <label>
                      Automatically encode special characters in URL
                      <input
                        type="checkbox"
                        name="settingEncodeUrl"
                        checked={request.settingEncodeUrl}
                        onChange={toggleCheckBox}
                      />
                      <HelpTooltip position="top" className="space-left">
                        Automatically encode special characters at send time (does not apply to query
                        parameters editor)
                      </HelpTooltip>
                    </label>
                  </div>
                  <div className="form-control form-control--thin">
                    <label>
                      Skip rendering of request body
                      <input
                        type="checkbox"
                        name="settingDisableRenderRequestBody"
                        checked={request.settingDisableRenderRequestBody}
                        onChange={toggleCheckBox}
                      />
                      <HelpTooltip position="top" className="space-left">
                        Disable rendering of environment variables and tags for the request body
                      </HelpTooltip>
                    </label>
                  </div>
                  <div className="form-control form-control--thin">
                    <label>
                      Rebuild path dot sequences
                      <HelpTooltip position="top" className="space-left">
                        This instructs libcurl to squash sequences of "/../" or "/./" that may exist in the
                        URL's path part and that is supposed to be removed according to RFC 3986 section
                        5.2.4
                      </HelpTooltip>
                      <input
                        type="checkbox"
                        name="settingRebuildPath"
                        checked={request['settingRebuildPath']}
                        onChange={toggleCheckBox}
                      />
                    </label>
                  </div>
                </div>
                <div className="form-control form-control--outlined">
                  <label>
                    Follow redirects <span className="txt-sm faint italic">(overrides global setting)</span>
                    <select
                      defaultValue={request.settingFollowRedirects}
                      name="settingFollowRedirects"
                      onChange={async event => {
                        const updated = await models.request.update(request, {
                          [event.currentTarget.name]: event.currentTarget.value,
                        });
                        setState(state => ({ ...state, request: updated }));
                      }}
                    >
                      <option value={'global'}>Use global setting</option>
                      <option value={'off'}>Don't follow redirects</option>
                      <option value={'on'}>Follow redirects</option>
                    </select>
                  </label>
                </div>
              </>
              <hr />
              <div className="form-row">
                <div className="form-control form-control--outlined">
                  <label>
                    Move/Copy to Workspace
                    <HelpTooltip position="top" className="space-left">
                      Copy or move the current request to a new workspace. It will be placed at the root of
                      the new workspace's folder structure.
                    </HelpTooltip>
                    <select
                      value={activeWorkspaceIdToCopyTo || '__NULL__'}
                      onChange={event => {
                        const { value } = event.currentTarget;
                        const workspaceId = value === '__NULL__' ? null : value;
                        setState(state => ({ ...state, activeWorkspaceIdToCopyTo: workspaceId }));
                      }}
                    >
                      <option value="__NULL__">-- Select Workspace --</option>
                      {workspacesForActiveProject.map(w => {
                        if (workspace && workspace._id === w._id) {
                          return null;
                        }

                        return (
                          <option key={w._id} value={w._id}>
                            {w.name}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                </div>
                <div className="form-control form-control--no-label width-auto">
                  <button
                    disabled={!activeWorkspaceIdToCopyTo}
                    className="btn btn--clicky"
                    onClick={handleCopyToWorkspace}
                  >
                    Copy
                  </button>
                </div>
                <div className="form-control form-control--no-label width-auto">
                  <button
                    disabled={!activeWorkspaceIdToCopyTo}
                    className="btn btn--clicky"
                    onClick={handleMoveToWorkspace}
                  >
                    Move
                  </button>
                </div>
              </div>
            </>)
          }
        </div>
      </ModalBody>
    </Modal>
  );
});

RequestSettingsModal.displayName = 'RequestSettingsModal';
