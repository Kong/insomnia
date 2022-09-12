import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';

import { database as db } from '../../../common/database';
import * as models from '../../../models';
import { WebSocketRequest } from '../../../models/websocket-request';
import { isWorkspace, Workspace } from '../../../models/workspace';
import { selectWorkspacesForActiveProject } from '../../redux/selectors';
import { DebouncedInput } from '../base/debounced-input';
import { type ModalProps, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { UnconnectedCodeEditor } from '../codemirror/code-editor';
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

  async function handleNameChange(name: string) {
    const { request: originalRequest } = state;

    if (!originalRequest) {
      return;
    }

    const patch = {
      name,
    };
    const updatedRequest = await models.webSocketRequest.update(
      originalRequest,
      patch
    );
    setState({ ...state, request: updatedRequest });
  }

  async function handleDescriptionChange(description: string) {
    if (!state.request) {
      return;
    }

    const request = await models.webSocketRequest.update(state.request, {
      description,
    });
    setState({
      ...state,
      request,
      defaultPreviewMode: false,
    });
  }

  function handleAddDescription() {
    setState({ ...state, showDescription: true });
  }

  async function show({ request, forceEditMode }: RequestSettingsModalOptions) {
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
  }

  function hide() {
    modalRef.current?.hide();
  }

  useImperativeHandle(ref, () => ({
    show,
    hide,
  }));

  const { showDescription, defaultPreviewMode, request } = state;

  if (!request) {
    return null;
  }

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
          <hr />
        </div>
      </ModalBody>
    </Modal>
  );
});

WebSocketRequestSettingsModal.displayName = 'WebSocketRequestSettingsModal';
