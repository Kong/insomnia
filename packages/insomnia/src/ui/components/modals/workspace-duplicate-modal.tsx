import React, { type FC, type MouseEventHandler, useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { href, useNavigate, useParams } from 'react-router';

import type { BaseModel, Project, Workspace } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useOrganizationLoaderData } from '~/routes/organization';
import { useWorkspaceMoveActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.move';

import { database } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { scopeToBgColorMap, scopeToIconMap, scopeToTextColorMap } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { Icon } from '../icon';

interface WorkspaceDuplicateModalProps extends ModalProps {
  workspace: Workspace;
  onHide: () => void;
}

export const WorkspaceDuplicateModal: FC<WorkspaceDuplicateModalProps> = ({ workspace, onHide }) => {
  const { organizationId, projectId: currentProjectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const organizationData = useOrganizationLoaderData();
  const [selectedOrgId, setSelectedOrgId] = useState(organizationId);
  const [projectOptions, setProjectOptions] = useState<BaseModel[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState(workspace.name);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const organizationProjects = await database.find<Project>(models.project.type, {
        parentId: selectedOrgId,
      });
      setProjectOptions(models.project.sortProjects(organizationProjects));
      setSelectedProjectId(organizationProjects[0]?._id || '');
    })();
  }, [selectedOrgId]);
  const fetcher = useWorkspaceMoveActionFetcher();

  const modalRef = useRef<ModalHandle>(null);
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  useEffect(() => {
    const fetcherResult = fetcher.data;
    if (
      fetcherResult &&
      !('error' in fetcherResult) &&
      fetcherResult.workspaceId &&
      fetcherResult.projectId &&
      fetcherResult.organizationId &&
      fetcherResult.workspaceScope
    ) {
      navigate(
        `${href('/organization/:organizationId/project/:projectId/workspace/:workspaceId', {
          organizationId: fetcherResult.organizationId,
          projectId: fetcherResult.projectId,
          workspaceId: fetcherResult.workspaceId,
        })}/${models.workspace.scopeToActivity(fetcherResult.workspaceScope)}`,
      );
      onHide();
    }
  }, [fetcher.data, navigate, onHide]);

  const isBtnDisabled = fetcher.state !== 'idle' || !selectedProjectId || !newWorkspaceName;

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal onHide={onHide} ref={modalRef}>
        <ModalHeader>Duplicate file</ModalHeader>
        <ModalBody className="wide">
          <p className="mb-6">You can duplicate the following file to a project:</p>
          <div className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font)">
            <div
              className={`${scopeToBgColorMap[workspace.scope]} ${scopeToTextColorMap[workspace.scope]} flex h-[20px] w-[20px] items-center justify-center rounded-s-sm px-2`}
            >
              <Icon icon={scopeToIconMap[workspace.scope]} />
            </div>
            <span>{workspace.name}</span>
            <span className="text-(--hl)">{getWorkspaceLabel(workspace).singular}</span>
          </div>
          <fetcher.Form
            action={href('/organization/:organizationId/project/:projectId/workspace/move', {
              organizationId,
              projectId: workspace.parentId,
            })}
            method="post"
            id="workspace-duplicate-form"
            className="wide pad"
          >
            <input name="workspaceId" value={workspace._id} readOnly className="hidden" />
            <div className="form-control form-control--outlined">
              <label>
                New {getWorkspaceLabel(workspace).singular.toLowerCase()} name:
                <input name="name" value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} />
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
                  {organizationData?.organizations.map(({ id, display_name }) => (
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
                      {project.name}
                      {project._id === currentProjectId && ' (current)'}
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
            {fetcher.data?.error && <p className="notice error margin-bottom-sm mt-6">{fetcher.data.error}</p>}
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
            <button disabled={isBtnDisabled} form="workspace-duplicate-form" className="btn">
              {fetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />} Duplicate
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};
