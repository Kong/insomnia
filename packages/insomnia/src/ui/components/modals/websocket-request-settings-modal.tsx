import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';

import { database as db } from '../../../common/database';
import * as models from '../../../models';
import * as requestOperations from '../../../models/helpers/request-operations';
import { WebSocketRequest } from '../../../models/websocket-request';
import { isWorkspace, Workspace } from '../../../models/workspace';
import { selectWorkspacesForActiveProject } from '../../redux/selectors';
import { DebouncedInput } from '../base/debounced-input';
import { type ModalProps, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { UnconnectedCodeEditor } from '../codemirror/code-editor';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';
interface State {
  request: WebSocketRequest | null;
  showDescription: boolean;
  defaultPreviewMode: boolean;
  activeWorkspaceIdToCopyTo: string | null;
  workspace?: Workspace;
  justCopied: boolean;
  justMoved: boolean;
}

interface RequestSettingsModalOptions {
  request: WebSocketRequest;
  forceEditMode: boolean;
}

export interface RequestSettingsModalHandle {
  show: (options: RequestSettingsModalOptions) => void;
  hide: () => void;
}

export const WebSocketRequestSettingsModal = forwardRef<RequestSettingsModalHandle, ModalProps>((_props, ref) => {
  const modalRef = useRef<Modal>(null);
  const editorRef = useRef<UnconnectedCodeEditor>(null);
  const [state, setState] = useState<State>({
    request: null,
    showDescription: false,
    defaultPreviewMode: false,
    activeWorkspaceIdToCopyTo: null,
    workspace: undefined,
    justCopied: false,
    justMoved: false,
  });

  const workspacesForActiveProject = useSelector(
    selectWorkspacesForActiveProject
  );

  const { showDescription, defaultPreviewMode, request } = state;
  async function _handleMoveToWorkspace() {
    const { activeWorkspaceIdToCopyTo, request } = state;
    if (!request || !activeWorkspaceIdToCopyTo) {
      return;
    }
    const workspace = await models.workspace.getById(activeWorkspaceIdToCopyTo);
    if (!workspace) {
      return;
    }
    const patch = {
      metaSortKey: -1e9,
      // Move to top of sort order
      parentId: activeWorkspaceIdToCopyTo,
    };
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    await requestOperations.update(request, patch);
    setState({
      ...state,
      justMoved: true,
    });
    setTimeout(() => {
      setState({
        ...state,
        justMoved: false,
      });
    }, 2000);
  }

  async function handleCopyToWorkspace() {
    const { activeWorkspaceIdToCopyTo, request } = state;
    if (!request || !activeWorkspaceIdToCopyTo) {
      return;
    }
    const workspace = await models.workspace.getById(activeWorkspaceIdToCopyTo);
    if (!workspace) {
      return;
    }
    const patch = {
      metaSortKey: -1e9,
      // Move to top of sort order
      name: request.name,
      // Because duplicate will add (Copy) suffix if name is not provided in patch
      parentId: activeWorkspaceIdToCopyTo,
    };

    await requestOperations.duplicate(request, patch);
    setState({
      ...state,
      justCopied: true,
    });
    setTimeout(() => {
      setState({
        ...state,
        justCopied: false,
      });
    }, 2000);
    models.stats.incrementCreatedRequests();
  }

  const handleNameChange = useCallback((name: string) => {
    const patch = {
      name,
    };
    async function update() {
      if (!request) {
        return;
      }
      const updatedRequest = await models.webSocketRequest.update(
        request,
        patch
      );
      setState(state => ({ ...state, request: updatedRequest }));
    }

    update();
  }, [request]);

  const handleDescriptionChange = useCallback((description: string) => {

    async function update() {
      if (!request) {
        return;
      }

      const updatedRequest = await models.webSocketRequest.update(request, {
        description,
      });

      setState(state => ({
        ...state,
        request: updatedRequest,
        defaultPreviewMode: false,
      }));
    }

    update();
  }, [request]);

  const handleAddDescription = () => {
    setState(state => ({ ...state, showDescription: true }));
  };

  const show = async ({ request, forceEditMode }: RequestSettingsModalOptions) => {
    const hasDescription = !!request.description;
    // Find workspaces for use with moving workspace
    const ancestors = await db.withAncestors(request);
    const doc = ancestors.find(isWorkspace);
    const workspaceId = doc ? doc._id : 'should-never-happen';
    const workspace = workspacesForActiveProject.find(
      w => w._id === workspaceId
    );
    setState(state => ({
      ...state,
      request,
      workspace: workspace,
      activeWorkspaceIdToCopyTo: null,
      showDescription: forceEditMode || hasDescription,
      defaultPreviewMode: hasDescription && !forceEditMode,
    }));

    modalRef.current?.show();

    if (forceEditMode) {
      setTimeout(() => {
        editorRef.current?.focus();
      }, 400);
    }
  };

  const hide = () => {
    modalRef.current?.hide();
  };

  useImperativeHandle(ref, () => ({
    show,
    hide,
  }));

  if (!request) {
    return null;
  }

  const toggleCheckBox = async (event:any) => {
    const updated = await requestOperations.update(request, {
      [event.currentTarget.name]: event.currentTarget.checked,
    });
    setState({
      ...state, request: updated,
    });
  };

  return (
    <Modal ref={modalRef} freshState>
      <ModalHeader>
        Request Settings{' '}
        <span className="txt-sm selectable faint monospace">
          {request ? request._id : ''}
        </span>
      </ModalHeader>
      <ModalBody className="pad">
        <div>
          <div className="form-control form-control--outlined">
            <label>
              Name{' '}
              <span className="txt-sm faint italic">
                (also rename by double-clicking in sidebar)
              </span>
              <DebouncedInput
                delay={500}
                // @ts-expect-error -- TSCONVERSION props expand into an input but are difficult to type
                type="text"
                placeholder={request.url || 'My Request'}
                defaultValue={request.name}
                onChange={handleNameChange}
              />
            </label>
          </div>
          {showDescription ? (
            <MarkdownEditor
              ref={editorRef}
              className="margin-top"
              defaultPreviewMode={defaultPreviewMode}
              placeholder="Write a description"
              defaultValue={request.description}
              onChange={handleDescriptionChange}
            />
          ) : (
            <button
              onClick={handleAddDescription}
              className="btn btn--outlined btn--super-duper-compact"
            >
              Add Description
            </button>
          )}
        </div>
        <>
          <div className="pad-top pad-bottom">
            <div className="form-control form-control--thin">
              <label>
                Send cookies automatically
                <input
                  type="checkbox"
                  name="settingSendCookies"
                  checked={request['settingSendCookies']}
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
                  checked={request['settingStoreCookies']}
                  onChange={toggleCheckBox}
                />
              </label>
            </div>
            {/* <div className="form-control form-control--thin">
              <label>
                Automatically encode special characters in URL
                <input
                  type="checkbox"
                  name="settingEncodeUrl"
                  checked={request['settingEncodeUrl']}
                  onChange={toggleCheckBox}
                />
                <HelpTooltip position="top" className="space-left">
                  Automatically encode special characters at send time (does not apply to query
                  parameters editor)
                </HelpTooltip>
              </label>
            </div> */}
            {/* <div className="form-control form-control--thin">
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
            </div> */}
          </div>
          {/* <div className="form-control form-control--outlined">
            <label>
              Follow redirects <span className="txt-sm faint italic">(overrides global setting)</span>
              <select
                defaultValue={state.request?.settingFollowRedirects}
                name="settingFollowRedirects"
                onChange={async event => {
                  const updated = await models.webSocketRequest.update(request, {
                    [event.currentTarget.name]: event.currentTarget.value,
                  });
                  setState({ ...state, request: updated });
                }}
              >
                <option value={'global'}>Use global setting</option>
                <option value={'off'}>Don't follow redirects</option>
                <option value={'on'}>Follow redirects</option>
              </select>
            </label>
          </div> */}
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
                value={state.activeWorkspaceIdToCopyTo || '__NULL__'}
                onChange={event => {
                  const { value } = event.currentTarget;
                  const workspaceId = value === '__NULL__' ? null : value;
                  setState({ ...state, activeWorkspaceIdToCopyTo: workspaceId });
                }}
              >
                <option value="__NULL__">-- Select Workspace --</option>
                {workspacesForActiveProject.map(w => {
                  if (state.workspace && state.workspace._id === w._id) {
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
              disabled={state.justCopied || !state.activeWorkspaceIdToCopyTo}
              className="btn btn--clicky"
              onClick={handleCopyToWorkspace}
            >
              {state.justCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="form-control form-control--no-label width-auto">
            <button
              disabled={state.justMoved || !state.activeWorkspaceIdToCopyTo}
              className="btn btn--clicky"
              onClick={_handleMoveToWorkspace}
            >
              {state.justMoved ? 'Moved!' : 'Move'}
            </button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
});

WebSocketRequestSettingsModal.displayName = 'WebSocketRequestSettingsModal';
