import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { strings } from '../../../common/strings';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { Button } from '../../components/themed-button';
import { selectActiveWorkspace } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
type Props = ModalProps & {
  vcs: VCS;
};
export interface SyncDeleteModalOptions {
  error: string;
  workspaceName: string;
  onHide?: () => void;
}
export interface SyncDeleteModalHandle {
  show: (options: SyncDeleteModalOptions) => void;
  hide: () => void;
}
export const SyncDeleteModal = forwardRef<SyncDeleteModalHandle, Props>(({ vcs }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<SyncDeleteModalOptions>({
    error: '',
    workspaceName: '',
  });

  useImperativeHandle(ref, () => ({
    hide: () => modalRef.current?.hide(),
    show: ({ onHide }) => {
      setState({
        error: '',
        workspaceName: '',
        onHide,
      });
      modalRef.current?.show({ onHide });
    },
  }), []);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const onSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await interceptAccessError({
        action: 'delete',
        callback: () => vcs.archiveProject(),
        resourceName: state.workspaceName,
        resourceType: strings.collection.singular.toLowerCase(),
      });
      modalRef.current?.hide();
    } catch (err) {
      setState(state => ({
        ...state,
        error: err.message,
      }));
    }
  };
  const { error, workspaceName } = state;

  return (
    <Modal ref={modalRef} skinny>
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
  );
});
SyncDeleteModal.displayName = 'SyncDeleteModal';
