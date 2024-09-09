import React, { type FC, type MouseEventHandler, useEffect, useRef, useState } from 'react';
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
import { scopeToBgColorMap, scopeToIconMap, scopeToTextColorMap } from '../../routes/project';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { Icon } from '../icon';

interface WorkspaceDuplicateModalProps extends ModalProps {
  workspace: Workspace;
  onHide: Function;
}

export const WorkspaceDuplicateModal: FC<WorkspaceDuplicateModalProps> = ({ workspace, onHide }) => {
  const { organizationId, projectId: currentProjectId } = useParams();
  const { organizations } = useOrganizationLoaderData();
  const [selectedOrgId, setSelectedOrgId] = useState(organizationId);
  const [projectOptions, setProjectOptions] = useState<models.BaseModel[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState(workspace.name);
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

  const isBtnDisabled = fetcher.state !== 'idle'
    || !selectedProjectId
    || !newWorkspaceName;

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal onHide={onHide} ref={modalRef}>
        <ModalHeader>Duplicate file</ModalHeader>
        <ModalBody className="wide">
          <p className='mb-6'>You can duplicate the following file to a project:</p>
          <div className="flex gap-2 px-[--padding-md] items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent">
            <div className={`${scopeToBgColorMap[workspace.scope]} ${scopeToTextColorMap[workspace.scope]} px-2 flex justify-center items-center h-[20px] w-[20px] rounded-s-sm`}>
              <Icon icon={scopeToIconMap[workspace.scope]} />
            </div>
            <span>{workspace.name}</span>
            <span className='text-[--hl]'>{getWorkspaceLabel(workspace).singular}</span>
          </div>
          <fetcher.Form
            action={`/organization/${organizationId}/project/${workspace.parentId}/workspace/${workspace._id}/duplicate`}
            method='post'
            id="workspace-duplicate-form"
            className="wide pad"
          >
            <input name="workspaceId" value={workspace._id} readOnly className="hidden" />
            <div className="form-control form-control--outlined">
              <label>
                New {getWorkspaceLabel(workspace).singular.toLowerCase()} name:
                <input
                  name="name"
                  value={newWorkspaceName}
                  onChange={e => setNewWorkspaceName(e.target.value)}
                />
              </label>
            </div>
            {!newWorkspaceName && (
              <p
                className="margin-top-sm"
                style={{
                  color: 'var(--color-danger)',
                }}
              >
                Name is required
              </p>
            )}
            <div className="form-control form-control--outlined">
              <label>
                Organization:
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
                {strings.project.singular}:
                <select name="projectId" value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                  {projectOptions.map(project => (
                    <option key={project._id} value={project._id}>
                      {project.name}{project._id === currentProjectId && ' (current)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!selectedProjectId && (
              <p
                className="margin-top-sm"
                style={{
                  color: 'var(--color-danger)',
                }}
              >
                Project is required
              </p>
            )}
            {fetcher.data?.error && (
              <p className="notice error margin-bottom-sm mt-6">
                {fetcher.data.error}
              </p>
            )}
          </fetcher.Form>
        </ModalBody>
        <ModalFooter>
          <div>
            <button
              disabled={isBtnDisabled}
              type="button"
              onClick={onHide as MouseEventHandler<HTMLButtonElement>}
              className="btn btn--no-background"
            >
              Cancel
            </button>
            <button
              disabled={isBtnDisabled}
              form="workspace-duplicate-form"
              className="btn"
            >
              {fetcher.state !== 'idle' && <Icon icon='spinner' className='animate-spin' />} Duplicate
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};
