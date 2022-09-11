import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { database as db } from '../../../common/database';
import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
import { selectWorkspacesForActiveProject } from '../../redux/selectors';
import { DebouncedInput } from '../base/debounced-input';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { UnconnectedCodeEditor } from '../codemirror/code-editor';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';

export interface RequestGroupSettingsModalOptions {
  requestGroup: RequestGroup;
  forceEditMode: boolean;
}
interface State {
  requestGroup: RequestGroup | null;
  showDescription: boolean;
  defaultPreviewMode: boolean;
  activeWorkspaceIdToCopyTo: string | null;
  workspace?: Workspace;
  workspacesForActiveProject: Workspace[];
  justCopied: boolean;
  justMoved: boolean;
}
export interface RequestGroupSettingsModalHandle {
  show: (options: RequestGroupSettingsModalOptions) => void;
  hide: () => void;
}
export const RequestGroupSettingsModal = forwardRef<RequestGroupSettingsModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<Modal>(null);
  const editorRef = useRef<UnconnectedCodeEditor>(null);
  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);
  const [state, setState] = useState<State>({
    requestGroup: null,
    showDescription: false,
    defaultPreviewMode: false,
    activeWorkspaceIdToCopyTo: null,
    workspace: undefined,
    workspacesForActiveProject: [],
    justCopied: false,
    justMoved: false,
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async ({ requestGroup, forceEditMode }) => {
      const hasDescription = !!requestGroup.description;

      // Find workspaces for use with moving workspace
      const ancestors = await db.withAncestors(requestGroup);
      const doc = ancestors.find(doc => doc.type === models.workspace.type);
      const workspaceId = doc ? doc._id : 'should-never-happen';
      const workspace = workspacesForActiveProject.find(w => w._id === workspaceId);

      setState({
        ...state,
        requestGroup,
        workspace,
        activeWorkspaceIdToCopyTo: null,
        showDescription: forceEditMode || hasDescription,
        defaultPreviewMode: hasDescription && !forceEditMode,
      });
      modalRef.current?.show();
    },
  }), [state, workspacesForActiveProject]);

  const _handleMoveToWorkspace = async () => {
    const { activeWorkspaceIdToCopyTo, requestGroup } = state;
    if (!requestGroup || !activeWorkspaceIdToCopyTo) {
      return;
    }
    const workspace = await models.workspace.getById(activeWorkspaceIdToCopyTo);
    if (!workspace) {
      return;
    }
    // TODO: if there are gRPC requests in a request group
    //  we should also copy the protofiles to the destination workspace - INS-267
    await models.requestGroup.duplicate(requestGroup, {
      metaSortKey: -1e9,
      parentId: activeWorkspaceIdToCopyTo,
      name: requestGroup.name, // Because duplicating will add (Copy) suffix
    });
    await models.requestGroup.remove(requestGroup);
    setState({ ...state, justMoved: true });
    setTimeout(() => {
      setState({ ...state, justMoved: false });
    }, 2000);
  };

  const _handleCopyToWorkspace = async () => {
    const { activeWorkspaceIdToCopyTo, requestGroup } = state;
    if (!requestGroup || !activeWorkspaceIdToCopyTo) {
      return;
    }
    const workspace = await models.workspace.getById(activeWorkspaceIdToCopyTo);
    if (!workspace) {
      return;
    }
    const patch = {
      metaSortKey: -1e9, // Move to top of sort order
      name: requestGroup.name, // Because duplicate will add (Copy) suffix if name is not provided in patch
      parentId: activeWorkspaceIdToCopyTo,
    };
    await models.requestGroup.duplicate(requestGroup, patch);
    setState({ ...state, justCopied: true });
    setTimeout(() => {
      setState({ ...state, justCopied: false });
    }, 2000);
    models.stats.incrementCreatedRequests();
  };

  const {
    requestGroup,
    showDescription,
    defaultPreviewMode,
    activeWorkspaceIdToCopyTo,
    justMoved,
    justCopied,
    workspace,
  } = state;
  if (!requestGroup) {
    return null;
  }
  return (
    <Modal ref={modalRef} freshState>
      <ModalHeader>
        Folder Settings{' '}
        <span className="txt-sm selectable faint monospace">
          {requestGroup ? requestGroup._id : ''}
        </span>
      </ModalHeader>
      <ModalBody className="pad"><div>
        <div className="form-control form-control--outlined">
          <label>
            Name
            <DebouncedInput
              delay={500}
              // @ts-expect-error -- TSCONVERSION props expand into an input but are difficult to type
              type="text"
              placeholder={requestGroup.name || 'My Folder'}
              defaultValue={requestGroup.name}
              onChange={async name => {
                const updatedRequestGroup = await models.requestGroup.update(
                  requestGroup,
                  { name },
                );
                setState({ ...state, requestGroup: updatedRequestGroup });
              }}
            />
          </label>
        </div>
        {showDescription ? (
          <MarkdownEditor
            ref={editorRef}
            className="margin-top"
            defaultPreviewMode={defaultPreviewMode}
            placeholder="Write a description"
            defaultValue={requestGroup.description}
            onChange={async (description: string) => {
              const updated = await models.requestGroup.update(requestGroup, { description });
              setState({ ...state, requestGroup: updated, defaultPreviewMode: false });
            }}
          />
        ) : (
          <button
            onClick={() => setState({ ...state, showDescription: true })}
            className="btn btn--outlined btn--super-duper-compact"
          >
            Add Description
          </button>
        )}
        <hr />
        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Move/Copy to Workspace
              <HelpTooltip position="top" className="space-left">
                Copy or move the current folder to a new workspace. It will be
                placed at the root of the new workspace's folder structure.
              </HelpTooltip>
              <select
                value={activeWorkspaceIdToCopyTo || '__NULL__'}
                onChange={event => {
                  const workspaceId = event.currentTarget.value === '__NULL__' ? null : event.currentTarget.value;
                  setState({ ...state, activeWorkspaceIdToCopyTo: workspaceId });
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
              disabled={justCopied || !activeWorkspaceIdToCopyTo}
              className="btn btn--clicky"
              onClick={_handleCopyToWorkspace}
            >
              {justCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="form-control form-control--no-label width-auto">
            <button
              disabled={justMoved || !activeWorkspaceIdToCopyTo}
              className="btn btn--clicky"
              onClick={_handleMoveToWorkspace}
            >
              {justMoved ? 'Moved!' : 'Move'}
            </button>
          </div>
        </div>
      </div></ModalBody>
    </Modal>
  );
});
RequestGroupSettingsModal.displayName = 'RequestGroupSettingsModal';
