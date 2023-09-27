import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useNavigate, useParams } from 'react-router-dom';

import type { RequestGroup } from '../../../models/request-group';
import { invariant } from '../../../utils/invariant';
import { useRequestGroupPatcher } from '../../hooks/use-request';
import { ProjectLoaderData } from '../../routes/project';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { CodeEditorHandle } from '../codemirror/code-editor';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';

export interface RequestGroupSettingsModalOptions {
  requestGroup: RequestGroup;
}
interface State {
  defaultPreviewMode: boolean;
  activeWorkspaceIdToCopyTo: string;
}
export const RequestGroupSettingsModal = ({ requestGroup, onHide }: ModalProps & {
  requestGroup: RequestGroup;
}) => {
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
    activeWorkspaceIdToCopyTo: '',
    defaultPreviewMode: !!requestGroup.description,
  });
  const patchRequestGroup = useRequestGroupPatcher();
  const requestFetcher = useFetcher();

  const duplicateRequestGroup = (r: Partial<RequestGroup>) => {
    requestFetcher.submit(r,
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/duplicate`,
        method: 'post',
        encType: 'application/json',
      });
  };
  useEffect(() => {
    modalRef.current?.show();
  }, []);
  const navigate = useNavigate();
  const handleMoveToWorkspace = async () => {
    invariant(state.activeWorkspaceIdToCopyTo, 'Workspace ID is required');
    patchRequestGroup(requestGroup._id, { parentId: state.activeWorkspaceIdToCopyTo });
    modalRef.current?.hide();
    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${state.activeWorkspaceIdToCopyTo}/debug`);
  };

  const handleCopyToWorkspace = async () => {
    invariant(state.activeWorkspaceIdToCopyTo, 'Workspace ID is required');
    duplicateRequestGroup({
      _id: requestGroup._id,
      name: requestGroup.name, // Because duplicate will add (Copy) suffix if name is not provided in patch
      parentId: state.activeWorkspaceIdToCopyTo,
    });
  };

  const {
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
                  patchRequestGroup(requestGroup._id, { name: event.target.value });
                }}
              />
            </label>
          </div>
          <MarkdownEditor
            ref={editorRef}
            className="margin-top"
            defaultPreviewMode={defaultPreviewMode}
            placeholder="Write a description"
            defaultValue={requestGroup?.description || ''}
            onChange={async (description: string) => {
              invariant(requestGroup, 'No request group');
              patchRequestGroup(requestGroup._id, { description });
            }}
          />
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
                  value={activeWorkspaceIdToCopyTo}
                  onChange={event => {
                    const activeWorkspaceIdToCopyTo = event.currentTarget.value;
                    setState(state => ({
                      ...state,
                      activeWorkspaceIdToCopyTo,
                    }));
                  }}
                >
                  <option value="">-- Select Workspace --</option>
                  {workspacesForActiveProject
                    .filter(w => workspaceId !== w._id)
                    .map(w => (
                      <option key={w._id} value={w._id}>
                        {w.name}
                      </option>
                    ))
                  }
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
