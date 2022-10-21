import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { ApiSpec } from '../../../models/api-spec';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import { isDefaultProject, isLocalProject, isRemoteProject } from '../../../models/project';
import { isDesign, Workspace } from '../../../models/workspace';
import { initializeLocalBackendProjectAndMarkForSync } from '../../../sync/vcs/initialize-backend-project';
import { useVCS } from '../../hooks/use-vcs';
import { activateWorkspace } from '../../redux/modules/workspace';
import { selectIsLoggedIn, selectProjects } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

interface ErrorModalOptions {
  workspace?: Workspace;
  apiSpec?: ApiSpec;
  onDone?: () => void;
}
export interface WorkspaceDuplicateModalHandle {
  show: (options: ErrorModalOptions) => void;
  hide: () => void;
}
export const WorkspaceDuplicateModal = forwardRef<WorkspaceDuplicateModalHandle, ModalProps>((_, ref) => {
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

  const projects = useSelector(selectProjects);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const dispatch = useDispatch();
  const vcs = useVCS({ workspaceId: state.workspace?._id });
  return (
    <Modal ref={modalRef}>
      <ModalHeader>{`Duplicate ${state.workspace && getWorkspaceLabel(state.workspace).singular}`}</ModalHeader>
      <ModalBody className="wide">
        <form
          onSubmit={async e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const newName = data.get('name') as string;
            const projectId = data.get('projectId') as string;
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
          }}
          method='post'
          id="workspace-duplicate-form"
          className="wide pad"
        >
          <div className="form-control form-control--wide form-control--outlined">
            <label>
              New Name
              <input name="name" defaultValue={state.workspace ? isDesign(state.workspace) ? (state.apiSpec?.fileName || '') : state.workspace.name : ''} />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              {strings.project.singular} to duplicate into
              <select defaultValue={state.workspace?.parentId} name="projectId">
                {projects.map(project => (
                  <option key={project._id} value={project._id}>
                    {project.name} ({isDefaultProject(project) ? strings.defaultProject.singular : isLocalProject(project) ? strings.localProject.singular : strings.remoteProject.singular})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <button type="submit" form="workspace-duplicate-form" className="btn">
          Duplicate
        </button>
      </ModalFooter>
    </Modal>
  );
});

WorkspaceDuplicateModal.displayName = 'WorkspaceDuplicateModal';
