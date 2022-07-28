import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { strings } from '../../../common/strings';
import * as models from '../../../models/index';
import { isRemoteProject, projectHasSettings } from '../../../models/project';
import { removeProject } from '../../redux/modules/project';
import { selectActiveProject } from '../../redux/selectors';
import { DebouncedInput } from '../base/debounced-input';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';

export interface ProjectSettingsModalHandle {
  show: () => void;
  hide: () => void;
}
export const displayName = 'ProjectSettingsModal';
export const ProjectSettingsModal = forwardRef<ProjectSettingsModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<Modal>(null);
  const project = useSelector(selectActiveProject);
  const dispatch = useDispatch();

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: () => {
      modalRef.current?.show();
    },
  }), []);

  const _handleRemoveProject = () => {
    dispatch(removeProject(project));
    modalRef.current?.hide();
  };
  const _handleRename = (name: string) => {
    models.project.update(project, { name });
  };
  if (!projectHasSettings(project)) {
    return null;
  }
  const isRemote = isRemoteProject(project);

  return (
    <Modal ref={modalRef} freshState>
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
              <DebouncedInput
                // @ts-expect-error -- TSCONVERSION props are spread into an input element
                type="text"
                delay={500}
                placeholder={`My ${strings.project.singular}`}
                defaultValue={project.name}
                onChange={_handleRename}
              />
            )}
          </label>
        </div>
        <h2>Actions</h2>
        <div className="form-control form-control--padded">
          <PromptButton
            onClick={_handleRemoveProject}
            addIcon
            className="width-auto btn btn--clicky inline-block"
          >
            <i className="fa fa-trash-o" /> Delete
          </PromptButton>
        </div>
      </ModalBody>
    </Modal>
  );
});
ProjectSettingsModal.displayName = displayName;

export default ProjectSettingsModal;
