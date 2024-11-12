import React, { type FC, type MouseEventHandler, useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useParams } from 'react-router-dom';

import { database } from '../../../common/database';
import { strings } from '../../../common/strings';
import { sortProjects } from '../../../models/helpers/project';
import * as models from '../../../models/index';
import type { Project } from '../../../models/project';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { Icon } from '../icon';

interface AddRequestModalProps extends ModalProps {
  onHide: Function;
}

export const AddRequestToCollectionModal: FC<AddRequestModalProps> = ({ onHide }) => {
  const { organizationId, projectId: currentProjectId, workspaceId: currentWorkspaceId } = useParams();
  const [projectOptions, setProjectOptions] = useState<models.BaseModel[]>([]);
  const [workspaceOptions, setWorkspaceOptions] = useState<models.BaseModel[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  const requestFetcher = useFetcher();

  useEffect(() => {
    (async () => {
      const organizationProjects = await database.find<Project>(models.project.type, {
        parentId: organizationId,
      });
      setProjectOptions(sortProjects(organizationProjects));
      setSelectedProjectId(organizationProjects[0]?._id || '');
    })();
  }, [organizationId]);

  useEffect(() => {
    (async () => {
      const workspaces = await models.workspace.findByParentId(selectedProjectId);
      const requestCollections = workspaces.filter(workspace => workspace.scope === 'collection');
      setWorkspaceOptions(requestCollections);
      setSelectedWorkspaceId(requestCollections[0]?._id || '');
    })();
  }, [selectedProjectId]);

  const modalRef = useRef<ModalHandle>(null);
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const isBtnDisabled = requestFetcher.state !== 'idle'
    || !selectedProjectId;

  const createNewRequest = async () => {
    requestFetcher.submit(
      { requestType: 'HTTP', parentId: selectedWorkspaceId },
      {
        action: `/organization/${organizationId}/project/${selectedProjectId}/workspace/${selectedWorkspaceId}/debug/request/new`,
        method: 'post',
        encType: 'application/json',
      },
    );
  };

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal onHide={onHide} ref={modalRef}>
        <ModalHeader>Add Request</ModalHeader>
        <ModalBody className="wide">
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

          <div className="form-control form-control--outlined">
            <label>
              {strings.workspace.singular}:
              <select name="workspaceId" value={selectedWorkspaceId} onChange={e => setSelectedWorkspaceId(e.target.value)}>
                {workspaceOptions.map(workspace => (
                  <option key={workspace._id} value={workspace._id}>
                    {workspace.name}{workspace._id === currentWorkspaceId && ' (current)'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!selectedWorkspaceId && (
            <p
              className="margin-top-sm"
              style={{
                color: 'var(--color-danger)',
              }}
            >
              Workspace is required
            </p>
          )}
          {requestFetcher.data?.error && (
            <p className="notice error margin-bottom-sm mt-6">
              {requestFetcher.data.error}
            </p>
          )}
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
              onClick={createNewRequest}
            >
              {requestFetcher.state !== 'idle' && <Icon icon='spinner' className='animate-spin' />} Save
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};
