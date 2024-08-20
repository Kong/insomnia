import React, { type FC, useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useParams } from 'react-router-dom';

import { database } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { sortProjects } from '../../../models/helpers/project';
import * as models from '../../../models/index';
import type { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { useOrganizationLoaderData } from '../../routes/organization';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { Icon } from '../icon';

interface WorkspaceMoveModalProps extends ModalProps {
  workspace: Workspace;
}

export const WorkspaceMoveModal: FC<WorkspaceMoveModalProps> = ({ workspace, onHide }) => {
  const { organizationId, projectId: currentProjectId } = useParams();
  const { organizations } = useOrganizationLoaderData();
  const [selectedOrgId, setSelectedOrgId] = useState(organizationId);
  const [projectOptions, setProjectOptions] = useState<models.BaseModel[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  useEffect(() => {
    (async () => {
      const organizationProjects = await database.find<Project>(models.project.type, {
        parentId: selectedOrgId,
      });
      setProjectOptions(sortProjects(organizationProjects));
      setSelectedProjectId(organizationProjects[0]?._id || '');
    })();
  }, [selectedOrgId]);
  const fetcher = useFetcher();
  const modalRef = useRef<ModalHandle>(null);
  useEffect(() => {
    modalRef.current?.show();
  }, []);
  const formRef = useRef(null);

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal onHide={onHide} ref={modalRef}>
        <ModalHeader>{`Move ${workspace && getWorkspaceLabel(workspace).singular}`}</ModalHeader>
        <ModalBody className="wide">
          <p>You can move {getWorkspaceLabel(workspace).singular.toLowerCase()} {workspace.name} to a different location:</p>
          <fetcher.Form
            action={`/organization/${organizationId}/project/${workspace.parentId}/workspace/${workspace._id}/move`}
            method='post'
            id="workspace-move-form"
            className="wide pad"
            ref={formRef}
          >
            <input name="workspaceId" value={workspace._id} readOnly className="hidden" />
            <div className="form-control form-control--outlined">
              <label>
                Select organization
                <select name="orgId" value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}>
                  {organizations.map(({ id, display_name }) => (
                    <option key={id} value={id}>
                      {display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-control form-control--outlined">
              <label>
                {strings.project.singular} to move into
                <select name="projectId" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                  {projectOptions.map(project => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {selectedProjectId === currentProjectId && (
              <p
                className="margin-top-sm"
                style={{
                  color: 'var(--color-danger)',
                }}
              >
                Cannot move into the same project
              </p>
            )}
          </fetcher.Form>
        </ModalBody>
        <ModalFooter>
          <button
            disabled={
              fetcher.state !== 'idle'
              || selectedProjectId === currentProjectId
              || !selectedProjectId
            }
            form="workspace-move-form"
            className="btn"
          >
            {fetcher.state !== 'idle' && <Icon icon='spinner' className='animate-spin' />} Move
          </button>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};
