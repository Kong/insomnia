import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { createRef, FC, forwardRef, ForwardRefRenderFunction, PureComponent, useImperativeHandle, useRef, useState } from 'react';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { ApiSpec } from '../../../models/api-spec';
import getWorkspaceName from '../../../models/helpers/get-workspace-name';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import { isDefaultProject, isLocalProject, isRemoteProject, Project } from '../../../models/project';
import { Workspace } from '../../../models/workspace';
import { initializeLocalBackendProjectAndMarkForSync } from '../../../sync/vcs/initialize-backend-project';
import { VCS } from '../../../sync/vcs/vcs';
import { activateWorkspace } from '../../redux/modules/workspace';
import { selectActiveProject, selectIsLoggedIn, selectProjects } from '../../redux/selectors';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from '.';

interface Options {
  workspace: Workspace;
  apiSpec: ApiSpec;
  onDone?: () => void;
}

interface FormFields {
  newName: string;
  projectId: string;
}

interface InnerProps extends Options, Props {
  hide: () => void;
}

const ProjectOption: FC<Project> = project => (
  <option key={project._id} value={project._id}>
    {project.name} ({isDefaultProject(project) ? strings.defaultProject.singular : isLocalProject(project) ? strings.localProject.singular : strings.remoteProject.singular})
  </option>
);

const WorkspaceDuplicateModalInternalWithRef: ForwardRefRenderFunction<Modal, InnerProps> = ({ workspace, apiSpec, onDone, hide, vcs }, ref) => {
  const dispatch = useDispatch();

  const projects = useSelector(selectProjects);
  const activeProject = useSelector(selectActiveProject);
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const title = `Duplicate ${getWorkspaceLabel(workspace).singular}`;
  const defaultWorkspaceName = getWorkspaceName(workspace, apiSpec);

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
    } } = useForm<FormFields>({
      defaultValues: {
        newName: defaultWorkspaceName,
        projectId: activeProject._id,
      },
    });

  const onSubmit = useCallback(async ({ projectId, newName }: FormFields) => {
    const duplicateToProject = projects.find(project => project._id === projectId);
    if (!duplicateToProject) {
      throw new Error('Project could not be found');
    }

    const newWorkspace = await workspaceOperations.duplicate(workspace, { name: newName, parentId: projectId });
    await models.workspace.ensureChildren(newWorkspace);

    // Mark for sync if logged in and in the expected project
    if (isLoggedIn && vcs && isRemoteProject(duplicateToProject)) {
      await initializeLocalBackendProjectAndMarkForSync({ vcs: vcs.newInstance(), workspace: newWorkspace });
    }

    dispatch(activateWorkspace({ workspace: newWorkspace }));
    hide();
    onDone?.();
  }, [dispatch, hide, isLoggedIn, onDone, projects, vcs, workspace]);

  return <Modal ref={ref} onShow={reset}>
    <ModalHeader>{title}</ModalHeader>
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
  </Modal>;
};

const WorkspaceDuplicateModalInternal = forwardRef(WorkspaceDuplicateModalInternalWithRef);

type Props = ModalProps & {
  vcs?: VCS;
};

interface ErrorModalOptions {
  workspace: Workspace;
  apiSpec: ApiSpec;
  onDone?: () => void;
}
export interface WorkspaceDuplicateModalHandle {
  show: (options: ErrorModalOptions) => void;
  hide: () => void;
}
export const WorkspaceDuplicateModal = forwardRef<WorkspaceDuplicateModalHandle, Props>(({ vcs }, ref) => {
  const modalRef = useRef<Modal>(null);
  const [state, setState] = useState<ErrorModalOptions>({});

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: (options: ErrorModalOptions) => {
      setState(options);
      modalRef.current?.show();
    },
  }), []);
  if (state) {
    return <WorkspaceDuplicateModalInternal
      ref={modalRef}
      workspace={state.workspace}
      apiSpec={state.apiSpec}
      onDone={state.onDone}
      vcs={vcs}
      hide={() => modalRef.current?.hide()}
    />;
  } else {
    return null;
  }
});
WorkspaceDuplicateModal.displayName = 'WorkspaceDuplicateModal';
