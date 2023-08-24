import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useNavigate, useParams } from 'react-router-dom';

import * as models from '../../../models';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { invariant } from '../../../utils/invariant';
import { useRequestPatcher } from '../../hooks/use-request';
import { ProjectLoaderData } from '../../routes/project';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { CodeEditorHandle } from '../codemirror/code-editor';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';

export interface RequestSettingsModalOptions {
  request: Request | GrpcRequest | WebSocketRequest;
}
interface State {
  defaultPreviewMode: boolean;
  activeWorkspaceIdToCopyTo: string;
}

export const RequestSettingsModal = ({ request, onHide }: ModalProps & RequestSettingsModalOptions) => {
  const modalRef = useRef<ModalHandle>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const workspacesFetcher = useFetcher();
  useEffect(() => {
    const isIdleAndUninitialized = workspacesFetcher.state === 'idle' && !workspacesFetcher.data;
    if (isIdleAndUninitialized) {
      workspacesFetcher.load(`/organization/${organizationId}/project/${projectId}`);
    }
  }, [organizationId, projectId, workspacesFetcher]);
  const projectLoaderData = workspacesFetcher?.data as ProjectLoaderData;
  const workspacesForActiveProject = projectLoaderData?.workspaces.map(w => w.workspace) || [];
  const [state, setState] = useState<State>({
    defaultPreviewMode: !!request?.description,
    activeWorkspaceIdToCopyTo: '',
  });
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const requestFetcher = useFetcher();
  const patchRequest = useRequestPatcher();
  const navigate = useNavigate();
  const duplicateRequest = (r: Partial<Request>) => {
    requestFetcher.submit(JSON.stringify(r),
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${request._id}/duplicate`,
        method: 'post',
        encType: 'application/json',
      });
  };
  async function handleMoveToWorkspace() {
    invariant(state.activeWorkspaceIdToCopyTo, 'Workspace ID is required');
    patchRequest(request._id, { parentId: state.activeWorkspaceIdToCopyTo });
    modalRef.current?.hide();
    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${state.activeWorkspaceIdToCopyTo}/debug`);
  }

  async function handleCopyToWorkspace() {
    invariant(state.activeWorkspaceIdToCopyTo, 'Workspace ID is required');
    duplicateRequest({ parentId: state.activeWorkspaceIdToCopyTo });
  }
  const { defaultPreviewMode, activeWorkspaceIdToCopyTo } = state;
  const toggleCheckBox = async (event: any) => {
    patchRequest(request._id, { [event.currentTarget.name]: event.currentTarget.checked ? true : false });
  };
  const updateDescription = (description: string) => {
    patchRequest(request._id, { description });
    setState({
      ...state,
      defaultPreviewMode: false,
    });
  };

  return (
    <OverlayContainer>
      <Modal ref={modalRef} onHide={onHide}>
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
                  onChange={event => patchRequest(request._id, { name: event.target.value })}
                />
              </label>
            </div>
            {request && isWebSocketRequest(request) && (
              <>
                <MarkdownEditor
                  ref={editorRef}
                  className="margin-top"
                  defaultPreviewMode={defaultPreviewMode}
                  placeholder="Write a description"
                  defaultValue={request.description}
                  onChange={updateDescription}
                />
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
                        value={activeWorkspaceIdToCopyTo}
                        onChange={event => {
                          const activeWorkspaceIdToCopyTo = event.currentTarget.value;
                          setState(state => ({ ...state, activeWorkspaceIdToCopyTo }));
                        }}
                      >
                        <option value="">-- Select Workspace --</option>
                        {workspacesForActiveProject.map(w => {
                          if (workspaceId === w._id) {
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
                <MarkdownEditor
                  ref={editorRef}
                  className="margin-top"
                  defaultPreviewMode={defaultPreviewMode}
                  placeholder="Write a description"
                  defaultValue={request.description}
                  onChange={updateDescription}
                />
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
                        value={activeWorkspaceIdToCopyTo}
                        onChange={event => {
                          const activeWorkspaceIdToCopyTo = event.currentTarget.value;
                          setState(state => ({ ...state, activeWorkspaceIdToCopyTo }));
                        }}
                      >
                        <option value="">-- Select Workspace --</option>
                        {workspacesForActiveProject.map(w => {
                          if (workspaceId === w._id) {
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
    </OverlayContainer>
  );
};
