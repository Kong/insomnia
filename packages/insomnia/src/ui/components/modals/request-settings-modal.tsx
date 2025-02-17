import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useNavigate, useParams } from 'react-router-dom';

import { isNotNullOrUndefined } from '../../../common/misc';
import * as models from '../../../models';
import { type GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isScratchpadOrganizationId } from '../../../models/organization';
import { isRequest, type Request } from '../../../models/request';
import { isWebSocketRequest, type WebSocketRequest } from '../../../models/websocket-request';
import { invariant } from '../../../utils/invariant';
import { useRequestPatcher } from '../../hooks/use-request';
import type { ListWorkspacesLoaderData } from '../../routes/project';
import { revalidateWorkspaceActiveRequest } from '../../routes/workspace';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';

export interface RequestSettingsModalOptions {
  request: Request | GrpcRequest | WebSocketRequest;
}

export const RequestSettingsModal = ({ request, onHide }: ModalProps & RequestSettingsModalOptions) => {
  const modalRef = useRef<ModalHandle>(null);
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const workspacesFetcher = useFetcher<ListWorkspacesLoaderData>();
  useEffect(() => {
    const isIdleAndUninitialized = workspacesFetcher.state === 'idle' && !workspacesFetcher.data;
    if (isIdleAndUninitialized && !isScratchpadOrganizationId(organizationId)) {
      workspacesFetcher.load(`/organization/${organizationId}/project/${projectId}/list-workspaces`);
    }
  }, [organizationId, projectId, workspacesFetcher]);
  const projectLoaderData = workspacesFetcher?.data;
  const workspacesForActiveProject = projectLoaderData?.files.map(w => w.workspace).filter(isNotNullOrUndefined).filter(w => w.scope !== 'mock-server') || [];
  const [workspaceToCopyTo, setWorkspaceToCopyTo] = useState('');
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
    invariant(workspaceToCopyTo, 'Workspace ID is required');
    patchRequest(request._id, { parentId: workspaceToCopyTo });
    // if active request is moved, clear the active request in the workspace
    revalidateWorkspaceActiveRequest(request._id, workspaceId);
    modalRef.current?.hide();
    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceToCopyTo}/debug`);
  }

  async function handleCopyToWorkspace() {
    invariant(workspaceToCopyTo, 'Workspace ID is required');
    duplicateRequest({ parentId: workspaceToCopyTo });
  }

  const toggleCheckBox = async (event: any) => {
    patchRequest(request._id, { [event.currentTarget.name]: event.currentTarget.checked ? true : false });
  };
  const updateReflectonApi = async (event: React.ChangeEvent<HTMLInputElement>) => {
    invariant(isGrpcRequest(request), 'Must be gRPC request');
    patchRequest(request._id, {
      reflectionApi: {
        ...request.reflectionApi,
        [event.currentTarget.name]: event.currentTarget.value,
      },
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
                        value={workspaceToCopyTo}
                        onChange={event => {
                          setWorkspaceToCopyTo(event.currentTarget.value);
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
                      disabled={!workspaceToCopyTo}
                      className="border border-solid border-[--hl-lg] px-[--padding-md] h-[--line-height-xs] rounded-[--radius-md] hover:bg-[--hl-xs]"
                      onClick={handleCopyToWorkspace}
                    >
                      Copy
                    </button>
                  </div>
                  <div className="form-control form-control--no-label width-auto">
                    <button
                      disabled={!workspaceToCopyTo}
                      className="border border-solid border-[--hl-lg] px-[--padding-md] h-[--line-height-xs] rounded-[--radius-md] hover:bg-[--hl-xs]"
                      onClick={handleMoveToWorkspace}
                    >
                      Move
                    </button>
                  </div>
                </div>
              </>)}
            {request && isGrpcRequest(request) && (
              <>
                <div className="form-control form-control--thin pad-top-sm">
                  <label>
                    Use the Buf Schema Registry API
                    <a href="https://buf.build/docs/bsr/reflection/overview" className="pad-left-sm">
                      <Icon icon="external-link" size="sm" />
                    </a>
                    <input
                      type="checkbox"
                      name="reflectionApi"
                      checked={request.reflectionApi.enabled}
                      onChange={event => patchRequest(request._id, {
                        reflectionApi: {
                          ...request.reflectionApi,
                          enabled: event.currentTarget.checked,
                        },
                      })}
                    />̵
                  </label>
                </div>
                <div className="form-row pad-top-sm">
                  {request.reflectionApi.enabled && (
                    <>
                      <div className="form-control form-control--outlined">
                        <label>
                          Reflection server URL
                          <a href="https://buf.build/docs/bsr/api-access" className="pad-left-sm">
                            <Icon icon="external-link" size="sm" />
                          </a>
                          <input
                            type="text"
                            name="url"
                            placeholder="https://buf.build"
                            defaultValue={request.reflectionApi.url}
                            onBlur={updateReflectonApi}
                            disabled={!request.reflectionApi.enabled}
                          />
                        </label>
                      </div>
                      <div className="form-control form-control--outlined">
                        <label>
                          Reflection server API key
                          <a href="https://buf.build/docs/bsr/authentication#manage-tokens" className="pad-left-sm">
                            <Icon icon="external-link" size="sm" />
                          </a>
                          <input
                            type="password"
                            name="apiKey"
                            defaultValue={request.reflectionApi.apiKey}
                            onBlur={updateReflectonApi}
                            disabled={!request.reflectionApi.enabled}
                          />
                        </label>
                      </div>
                      <div className="form-control form-control--outlined">
                        <label>
                          Module
                          <a href="https://buf.build/docs/bsr/module/manage" className="pad-left-sm">
                            <Icon icon="external-link" size="sm" />
                          </a>
                          <input
                            type="text"
                            name="module"
                            placeholder="buf.build/connectrpc/eliza"
                            defaultValue={request.reflectionApi.module}
                            onBlur={updateReflectonApi}
                            disabled={!request.reflectionApi.enabled}
                          />
                        </label>
                      </div>
                    </>
                  )}
                </div>
                <p className="faint italic pad-top">
                  Are there any gRPC settings you expect to see? Create a{' '}
                  <a href={'https://github.com/Kong/insomnia/issues/new/choose'}>feature request</a>!
                </p>
              </>
            )}
            {request && isRequest(request) && (
              <>
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
                          await models.request.update(request, {
                            [event.currentTarget.name]: event.currentTarget.value,
                          });
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
                        value={workspaceToCopyTo}
                        onChange={event => {
                          setWorkspaceToCopyTo(event.currentTarget.value);
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
                      disabled={!workspaceToCopyTo}
                      className="border border-solid border-[--hl-lg] px-[--padding-md] h-[--line-height-xs] rounded-[--radius-md] hover:bg-[--hl-xs]"
                      onClick={handleCopyToWorkspace}
                    >
                      Copy
                    </button>
                  </div>
                  <div className="form-control form-control--no-label width-auto">
                    <button
                      disabled={!workspaceToCopyTo}
                      className="border border-solid border-[--hl-lg] px-[--padding-md] h-[--line-height-xs] rounded-[--radius-md] hover:bg-[--hl-xs]"
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
