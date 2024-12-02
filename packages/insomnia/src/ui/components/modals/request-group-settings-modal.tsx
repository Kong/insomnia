import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useNavigate, useParams } from 'react-router-dom';

import { isNotNullOrUndefined } from '../../../common/misc';
import type { RequestGroup } from '../../../models/request-group';
import { invariant } from '../../../utils/invariant';
import { useRequestGroupPatcher } from '../../hooks/use-request';
import type { ListWorkspacesLoaderData } from '../../routes/project';
import { revalidateWorkspaceActiveRequestByFolder } from '../../routes/workspace';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { HelpTooltip } from '../help-tooltip';

export interface RequestGroupSettingsModalOptions {
  requestGroup: RequestGroup;
}

export const RequestGroupSettingsModal = ({ requestGroup, onHide }: ModalProps & {
  requestGroup: RequestGroup;
}) => {
  const modalRef = useRef<ModalHandle>(null);
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const workspacesFetcher = useFetcher<ListWorkspacesLoaderData>();
  useEffect(() => {
    const isIdleAndUninitialized = workspacesFetcher.state === 'idle' && !workspacesFetcher.data;
    if (isIdleAndUninitialized) {
      workspacesFetcher.load(`/organization/${organizationId}/project/${projectId}/list-workspaces`);
    }
  }, [organizationId, projectId, workspacesFetcher]);
  const projectLoaderData = workspacesFetcher?.data;
  const workspacesForActiveProject = projectLoaderData?.files.map(w => w.workspace).filter(isNotNullOrUndefined).filter(w => w.scope !== 'mock-server') || [];
  const [workspaceToCopyTo, setWorkspaceToCopyTo] = useState('');
  const patchRequestGroup = useRequestGroupPatcher();
  const requestFetcher = useFetcher();

  const duplicateRequestGroup = (r: Partial<RequestGroup>) => {
    requestFetcher.submit(JSON.stringify(r),
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
    invariant(workspaceToCopyTo, 'Workspace ID is required');
    patchRequestGroup(requestGroup._id, { parentId: workspaceToCopyTo });
    // if the folder is moved to a different workspace, we need to revalidate the active request
    revalidateWorkspaceActiveRequestByFolder(requestGroup, workspaceId);
    modalRef.current?.hide();
    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceToCopyTo}/debug`);
  };

  const handleCopyToWorkspace = async () => {
    invariant(workspaceToCopyTo, 'Workspace ID is required');
    duplicateRequestGroup({
      _id: requestGroup._id,
      name: requestGroup.name, // Because duplicate will add (Copy) suffix if name is not provided in patch
      parentId: workspaceToCopyTo,
    });
  };

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
          <div className="form-row">
            <div className="form-control form-control--outlined">
              <label>
                Move/Copy to Workspace
                <HelpTooltip position="top" className="space-left">
                  Copy or move the current folder to a new workspace. It will be
                  placed at the root of the new workspace's folder structure.
                </HelpTooltip>
                <select
                  value={workspaceToCopyTo}
                  onChange={event => {
                    setWorkspaceToCopyTo(event.currentTarget.value);
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
        </div></ModalBody>
      </Modal>
    </OverlayContainer>
  );
};
