import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useRouteLoaderData } from 'react-router-dom';

import { strings } from '../../../common/strings';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { Button } from '../../components/themed-button';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
type Props = ModalProps & {
  vcs: VCS;
};

interface State {
  error?: string;
  workspaceName: string;
}

export const SyncDeleteModal = ({ vcs, onHide }: Props) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    error: '',
    workspaceName: '',
  });
  const {
    activeWorkspace,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  useEffect(() => {
    modalRef.current?.show();
  }, []);
  const onSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await interceptAccessError({
        action: 'delete',
        callback: async () => await vcs.archiveProject(),
        resourceName: state.workspaceName,
        resourceType: strings.collection.singular.toLowerCase(),
      });
      modalRef.current?.hide();
      onHide?.();
    } catch (err) {
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  };
  const { error, workspaceName } = state;

  return (
    <OverlayContainer>
      <Modal ref={modalRef} skinny onHide={onHide}>
        <ModalHeader>Delete {strings.collection.singular}</ModalHeader>
        <ModalBody className="wide pad-left pad-right text-center" noScroll>
          {error && <p className="notice error margin-bottom-sm no-margin-top">{error}</p>}
          <p className="selectable">
            This will permanently delete the {<strong style={{ whiteSpace: 'pre-wrap' }}>{activeWorkspace?.name}</strong>}{' '}
            {strings.collection.singular.toLowerCase()} remotely.
          </p>
          <p className="selectable">Please type {<strong style={{ whiteSpace: 'pre-wrap' }}>{activeWorkspace?.name}</strong>} to confirm.</p>
          <form onSubmit={onSubmit}>
            <div className="form-control form-control--outlined">
              <input
                type="text"
                onChange={event => setState(state => ({ ...state, workspaceName: event.target.value }))}
                value={workspaceName}
              />
              <Button bg="danger" disabled={workspaceName !== activeWorkspace?.name}>
                Delete {strings.collection.singular}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </OverlayContainer>
  );
};
