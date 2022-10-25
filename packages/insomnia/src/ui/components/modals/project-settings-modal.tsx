import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { useFetcher } from 'react-router-dom';

import { strings } from '../../../common/strings';
import { isRemoteProject, projectHasSettings } from '../../../models/project';
import { useProjectLoaderData } from '../../routes/project';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';

export interface ProjectSettingsModalHandle {
  show: () => void;
  hide: () => void;
}

export const ProjectSettingsModal = forwardRef<ProjectSettingsModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const { activeProject: project } = useProjectLoaderData();
  const { submit } = useFetcher();
  useImperativeHandle(ref, () => ({
    hide: () => modalRef.current?.hide(),
    show: () => modalRef.current?.show(),
  }), []);

  if (!projectHasSettings(project)) {
    return null;
  }

  const isRemote = isRemoteProject(project);

  return (
    <Modal ref={modalRef}>
      <ModalHeader key={`header::${project._id}`}>
        {strings.project.singular} Settings{' '}
        <div className="txt-sm selectable faint monospace">{project._id}</div>
      </ModalHeader>
      <ModalBody key={`body::${project._id}`} className="pad">
        <div className="form-control form-control--outlined">
          <label>
            Name
            {isRemote && (
              <>
                <HelpTooltip className="space-left">
                  To rename a {strings.remoteProject.singular.toLowerCase()} {strings.project.singular.toLowerCase()} please visit <a href="https://app.insomnia.rest/app/teams">the insomnia website.</a>
                </HelpTooltip>
                <input disabled readOnly defaultValue={project.name} />
              </>
            )}
            {!isRemote && (
              <input
                type="text"
                placeholder={`My ${strings.project.singular}`}
                defaultValue={project.name}
                onChange={e => {
                  submit({
                    name: e.currentTarget.value,
                  }, {
                    action: `/project/${project._id}/rename`,
                    method: 'post',
                  });
                }}
              />
            )}
          </label>
        </div>
        <h2>Actions</h2>
        <div className="form-control form-control--padded">
          <PromptButton
            onClick={() => submit({}, { method: 'post', action: `/project/${project._id}/delete` })}
            className="width-auto btn btn--clicky inline-block"
          >
            <i className="fa fa-trash-o" /> Delete
          </PromptButton>
        </div>
      </ModalBody>
    </Modal>
  );
});
ProjectSettingsModal.displayName = 'ProjectSettingsModal';

export default ProjectSettingsModal;
