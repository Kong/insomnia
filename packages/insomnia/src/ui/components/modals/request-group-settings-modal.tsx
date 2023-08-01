import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import { invariant } from '../../../utils/invariant';
import { selectWorkspacesForActiveProject } from '../../redux/selectors';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { CodeEditorHandle } from '../codemirror/code-editor';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';

export interface RequestGroupSettingsModalOptions {
  requestGroup: RequestGroup;
  forceEditMode?: boolean;
}
interface State {
  showDescription: boolean;
  defaultPreviewMode: boolean;
  activeWorkspaceIdToCopyTo: string | null;
}
export const RequestGroupSettingsModal = ({ requestGroup, forceEditMode, onHide }: ModalProps & {
  requestGroup: RequestGroup;
  forceEditMode?: boolean;
}) => {
  const modalRef = useRef<ModalHandle>(null);
  const editorRef = useRef<CodeEditorHandle>(null);
  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);
  const hasDescription = !!requestGroup.description;
  // Find this request workspace for filtering out of workspaces list
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, setState] = useState<State>({
    activeWorkspaceIdToCopyTo: null,
    showDescription: forceEditMode || hasDescription,
    defaultPreviewMode: hasDescription && !forceEditMode,
  });
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const handleMoveToWorkspace = async () => {
    const { activeWorkspaceIdToCopyTo } = state;
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
    // TODO clean up this so it doesn't orphan descendants
    await models.requestGroup.remove(requestGroup);
    modalRef.current?.hide();
  };

  const handleCopyToWorkspace = async () => {
    const { activeWorkspaceIdToCopyTo } = state;
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
    showDescription,
    defaultPreviewMode,
    activeWorkspaceIdToCopyTo,
  } = state;
  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal ref={modalRef} onHide={onHide}>
        <ModalHeader>
          Folder Settings{' '}
          <span className="txt-sm selectable faint monospace">
            {requestGroup?._id || ''}
          </span>
        </ModalHeader>
        <ModalBody className="pad"><div>
          <div className="form-control form-control--outlined">
            <label>
              Name
              <input
                type="text"
                placeholder={requestGroup?.name || 'My Folder'}
                defaultValue={requestGroup?.name}
                onChange={async event => {
                  invariant(requestGroup, 'No request group');
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
              defaultValue={requestGroup?.description || ''}
              onChange={async (description: string) => {
                invariant(requestGroup, 'No request group');
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
                  onChange={event => setState(state => ({ ...state, activeWorkspaceIdToCopyTo: event.currentTarget.value === '__NULL__' ? null : event.currentTarget.value }))}
                >
                  <option value="__NULL__">-- Select Workspace --</option>
                  {workspacesForActiveProject
                    .filter(w => workspaceId !== w._id)
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
    </OverlayContainer>
  );
};
