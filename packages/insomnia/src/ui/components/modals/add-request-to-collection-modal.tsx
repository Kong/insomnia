import type { BaseModel } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { strings } from 'insomnia-data/common';
import React, { type FC, type MouseEventHandler, useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useParams } from 'react-router';

import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';

import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { Icon } from '../icon';

interface AddRequestModalProps extends ModalProps {
  onHide: () => void;
}

export const AddRequestToCollectionModal: FC<AddRequestModalProps> = ({ onHide }) => {
  const {
    organizationId,
    projectId: currentProjectId,
    workspaceId: currentWorkspaceId,
  } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const [projectOptions, setProjectOptions] = useState<BaseModel[]>([]);
  const [workspaceOptions, setWorkspaceOptions] = useState<BaseModel[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  const requestFetcher = useRequestNewActionFetcher();

  useEffect(() => {
    (async () => {
      const organizationProjects = await services.project.listByOrganizationIds(organizationId);
      setProjectOptions(models.project.sortProjects(organizationProjects));
      setSelectedProjectId(organizationProjects[0]?._id || '');
    })();
  }, [organizationId]);

  useEffect(() => {
    (async () => {
      const workspaces = await services.workspace.findByParentId(selectedProjectId);
      const requestCollections = workspaces.filter(workspace => workspace.scope === 'collection');
      setWorkspaceOptions(requestCollections);
      setSelectedWorkspaceId(requestCollections[0]?._id || '');
    })();
  }, [selectedProjectId]);

  const modalRef = useRef<ModalHandle>(null);
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const isBtnDisabled = requestFetcher.state !== 'idle' || !selectedProjectId || !selectedWorkspaceId;

  const previousRequestFetcherState = useRef('idle');

  const createNewRequest = async () => {
    requestFetcher.submit({
      organizationId,
      projectId: selectedProjectId,
      workspaceId: selectedWorkspaceId,
      requestType: 'HTTP',
      parentId: selectedWorkspaceId,
      metrics: {
        source: 'add-request-to-collection-modal',
      },
    });
    previousRequestFetcherState.current = 'loading';
  };

  useEffect(() => {
    if (previousRequestFetcherState?.current === 'loading' && requestFetcher.state === 'idle') {
      // when action is completed, close the modal
      onHide();
      previousRequestFetcherState.current = 'idle';
    }
  }, [onHide, requestFetcher.state]);

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal onHide={onHide} ref={modalRef}>
        <ModalHeader>Add Request</ModalHeader>
        <ModalBody className="wide">
          <div className="form-control form-control--outlined">
            <label>
              {strings.project.plural}:
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

          <div className="form-control form-control--outlined">
            <label>
              {strings.collection.plural}:
              <select
                aria-label="Select Workspace"
                name="workspaceId"
                value={selectedWorkspaceId}
                onChange={e => setSelectedWorkspaceId(e.target.value)}
              >
                {workspaceOptions.map(workspace => (
                  <option aria-label={workspace.name} key={workspace._id} value={workspace._id}>
                    {workspace.name}
                    {workspace._id === currentWorkspaceId && ' (current)'}
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
              Collection is required
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <div>
            <button
              type="button"
              onClick={onHide as MouseEventHandler<HTMLButtonElement>}
              className="btn btn--no-background"
            >
              Cancel
            </button>
            <button disabled={isBtnDisabled} form="workspace-duplicate-form" className="btn" onClick={createNewRequest}>
              {requestFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />} Add
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};
