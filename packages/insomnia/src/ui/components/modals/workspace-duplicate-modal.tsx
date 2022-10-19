import React, { FC, forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';

import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { ApiSpec } from '../../../models/api-spec';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import { isDefaultProject, isLocalProject, isRemoteProject, Project } from '../../../models/project';
import { isDesign, Workspace } from '../../../models/workspace';
import { initializeLocalBackendProjectAndMarkForSync } from '../../../sync/vcs/initialize-backend-project';
import { VCS } from '../../../sync/vcs/vcs';
import { activateWorkspace } from '../../redux/modules/workspace';
import { selectActiveProject, selectIsLoggedIn, selectProjects } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

interface FormFields {
  newName: string;
  projectId: string;
}

const ProjectOption: FC<Project> = project => (
  <option key={project._id} value={project._id}>
    {project.name} ({isDefaultProject(project) ? strings.defaultProject.singular : isLocalProject(project) ? strings.localProject.singular : strings.remoteProject.singular})
  </option>
);

type Props = ModalProps & {
  vcs?: VCS;
};

interface ErrorModalOptions {
  workspace?: Workspace;
  apiSpec?: ApiSpec;
  onDone?: () => void;
}
export interface WorkspaceDuplicateModalHandle {
  show: (options: ErrorModalOptions) => void;
  hide: () => void;
}
export const WorkspaceDuplicateModal = forwardRef<WorkspaceDuplicateModalHandle, Props>(({ vcs }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<ErrorModalOptions>({});
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({ workspace, apiSpec, onDone }: ErrorModalOptions) => {
      setState({ workspace, apiSpec, onDone });
      modalRef.current?.show();
    },
  }), []);

  const activeProject = useSelector(selectActiveProject);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors } } = useForm<FormFields>({
      defaultValues: {
        newName: state.workspace ? isDesign(state.workspace) ? (state.apiSpec?.fileName || '') : state.workspace.name : '',
        projectId: activeProject._id,
      },
    });

  const dispatch = useDispatch();
  const projects = useSelector(selectProjects);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const onSubmit = useCallback(async ({ projectId, newName }: FormFields) => {
    const duplicateToProject = projects.find(project => project._id === projectId);
    if (!duplicateToProject) {
      throw new Error('Project could not be found');
    }
    if (!state.workspace) {
      throw new Error('Workspace could not be found');
    }
    const newWorkspace = await workspaceOperations.duplicate(state.workspace, { name: newName, parentId: projectId });
    await models.workspace.ensureChildren(newWorkspace);
    // Mark for sync if logged in and in the expected project
    if (isLoggedIn && vcs && isRemoteProject(duplicateToProject)) {
      await initializeLocalBackendProjectAndMarkForSync({ vcs: vcs.newInstance(), workspace: newWorkspace });
    }
    dispatch(activateWorkspace({ workspace: newWorkspace }));
    modalRef.current?.hide();
    state?.onDone?.();
  }, [dispatch, isLoggedIn, projects, vcs, state]);

  return (
    <Modal ref={modalRef} onShow={reset}>
      <ModalHeader>{`Duplicate ${state.workspace && getWorkspaceLabel(state.workspace).singular}`}</ModalHeader>
      <ModalBody className="wide">
        <form className="wide pad" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-control form-control--wide form-control--outlined">
            <label>
              New Name
              <input {...register('newName', { validate: v => Boolean(v.trim()) || 'Should not be blank' })} />
              {errors.newName && <div className="font-error space-top">{errors.newName.message}</div>}
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              {strings.project.singular} to duplicate into
              <select {...register('projectId')}>
                {projects.map(ProjectOption)}
              </select>
            </label>
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={handleSubmit(onSubmit)}>
          Duplicate
        </button>
      </ModalFooter>
    </Modal>
  );
});
WorkspaceDuplicateModal.displayName = 'WorkspaceDuplicateModal';
