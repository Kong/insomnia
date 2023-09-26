import React, { FC, Fragment, useEffect, useRef } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useParams } from 'react-router-dom';

import { strings } from '../../../common/strings';
import { isDefaultOrganizationProject, Project } from '../../../models/project';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { showAlert } from '.';

export interface ProjectSettingsModalProps extends ModalProps {
  project: Project;
}

export const ProjectSettingsModal: FC<ProjectSettingsModalProps> = ({ project, onHide }) => {
  const modalRef = useRef<ModalHandle>(null);
  const { organizationId } = useParams<{organizationId: string}>();
  const { submit, Form, data, state } = useFetcher();

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  useEffect(() => {
    if (data && data.error && state === 'idle') {
      showAlert({
        title: 'Could not rename project',
        message: data.error,
      });
    }
  }, [data, state]);

  return (
    <OverlayContainer>
      <Modal onHide={onHide} ref={modalRef}>
        <ModalHeader key={`header::${project._id}`}>
          {strings.project.singular} Settings{' '}
          <div className="txt-sm selectable faint monospace">{project._id}</div>
        </ModalHeader>
        <ModalBody key={`body::${project._id}`} className="pad">
          <Form
            method="post"
            action={`/organization/${organizationId}/project/${project._id}/rename`}
            className="form-control form-control--outlined"
          >
            <label>
              Name
              <input
                type="text"
                name="name"
                placeholder={`My ${strings.project.singular}`}
                defaultValue={project.name}
              />
            </label>
            <button type="submit" className="btn btn--clicky">
              Update
            </button>
          </Form>
          {!isDefaultOrganizationProject(project) && <Fragment>
            <h2>Actions</h2>
            <div className="form-control form-control--padded">
              <PromptButton
                onClick={() =>
                  submit(
                    {},
                    { method: 'post', action: `/organization/${organizationId}/project/${project._id}/delete` }
                  )
                }
                className="width-auto btn btn--clicky inline-block"
              >
                <i className="fa fa-trash-o" /> Delete
              </PromptButton>
            </div>
          </Fragment>}

        </ModalBody>
      </Modal>
    </OverlayContainer>
  );
};

ProjectSettingsModal.displayName = 'ProjectSettingsModal';

export default ProjectSettingsModal;
