import React, { FC, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router-dom';

import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { isDefaultProject, isLocalProject, Project } from '../../../models/project';
import { Workspace } from '../../../models/workspace';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

interface WorkspaceDuplicateModalProps extends ModalProps {
  workspace: Workspace;
  projects: Project[];
}

export const WorkspaceDuplicateModal: FC<WorkspaceDuplicateModalProps> = ({ workspace, projects, ...modalProps }) => {
  const { Form } = useFetcher();
  const modalRef = useRef<ModalHandle>(null);

  useEffect(() => {
    modalRef.current?.show();
  });

  return (
    <Modal {...modalProps} ref={modalRef}>
      <ModalHeader>{`Duplicate ${workspace && getWorkspaceLabel(workspace).singular}`}</ModalHeader>
      <ModalBody className="wide">
        <Form
          onSubmit={() => {
            modalRef.current?.hide();
          }}
          method='post'
          action={`/project/${workspace.parentId}/workspace/${workspace._id}/duplicate`}
          id="workspace-duplicate-form"
          className="wide pad"
        >
          <div className="form-control form-control--wide form-control--outlined">
            <label>
              New Name
              <input name="name" defaultValue={workspace.name} />
            </label>
          </div>
          <input name="workspaceId" value={workspace._id} readOnly className="hidden" />
          <div className="form-control form-control--outlined">
            <label>
              {strings.project.singular} to duplicate into
              <select defaultValue={workspace.parentId} name="projectId">
                {projects.map(project => (
                  <option key={project._id} value={project._id}>
                    {project.name} ({isDefaultProject(project) ? strings.defaultProject.singular : isLocalProject(project) ? strings.localProject.singular : strings.remoteProject.singular})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Form>
      </ModalBody>
      <ModalFooter>
        <button type="submit" form="workspace-duplicate-form" className="btn">
          Duplicate
        </button>
      </ModalFooter>
    </Modal>
  );
};
