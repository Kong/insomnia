import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { database as db } from '../../../common/database';
import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
import { selectWorkspacesForActiveProject } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { CodeEditorHandle } from '../codemirror/code-editor';
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
}
export interface RequestGroupSettingsModalHandle {
  show: (options: RequestGroupSettingsModalOptions) => void;
  hide: () => void;
}
export const RequestGroupSettingsModal = forwardRef<RequestGroupSettingsModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);
  const [state, setState] = useState<State>({
    requestGroup: null,
    showDescription: false,
    defaultPreviewMode: false,
    activeWorkspaceIdToCopyTo: null,
    workspace: undefined,
    workspacesForActiveProject: [],
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async ({ requestGroup, forceEditMode }) => {
      const hasDescription = !!requestGroup.description;
      // Find this request workspace for filtering out of workspaces list
      const ancestors = await db.withAncestors(requestGroup);
      const workspace = workspacesForActiveProject
        .find(w => w._id === ancestors.find(doc => doc.type === models.workspace.type)?._id);

      setState(state => ({
        ...state,
        requestGroup,
        workspace,
        activeWorkspaceIdToCopyTo: null,
        showDescription: forceEditMode || hasDescription,
        defaultPreviewMode: hasDescription && !forceEditMode,
      }));
      modalRef.current?.show();
    },
  }), [workspacesForActiveProject]);

  const handleMoveToWorkspace = async () => {
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
  };

  const handleCopyToWorkspace = async () => {
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
    models.stats.incrementCreatedRequests();
  };

  const {
    requestGroup,
    showDescription,
    defaultPreviewMode,
    activeWorkspaceIdToCopyTo,
    workspace,
  } = state;
  if (!requestGroup) {
    return null;
  }
  return (
    <Modal ref={modalRef}>
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
            <input
              type="text"
              placeholder={requestGroup.name || 'My Folder'}
              defaultValue={requestGroup.name}
              onChange={async event => {
                const updatedRequestGroup = await models.requestGroup.update(requestGroup, { name: event.target.value });
                setState(state => ({ ...state, requestGroup: updatedRequestGroup }));
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
              setState(state => ({ ...state, requestGroup: updated, defaultPreviewMode: false }));
            }}
          />
        ) : (
          <button
            onClick={() => setState(state => ({ ...state, showDescription: true }))}
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
                  setState(state => ({ ...state, activeWorkspaceIdToCopyTo: workspaceId }));
                }}
              >
                <option value="__NULL__">-- Select Workspace --</option>
                {workspacesForActiveProject
                  .filter(w => workspace?._id !== w._id)
                  .map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
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
      </div></ModalBody>
    </Modal>
  );
});
RequestGroupSettingsModal.displayName = 'RequestGroupSettingsModal';
