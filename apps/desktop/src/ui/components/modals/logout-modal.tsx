import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import type { ModalHandle, ModalProps } from '../base/modal';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

interface State {
  onConfirm: (clearCredentials: boolean) => Promise<void>;
  loading?: boolean;
}

export interface LogoutModalHandle {
  show: (options: State) => void;
  hide: () => void;
}

export const LogoutModal = forwardRef<LogoutModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    onConfirm: async () => {},
    loading: false,
  });
  const [clearCredentials, setClearCredentials] = useState(true);

  useImperativeHandle(
    ref,
    () => ({
      hide: () => {
        modalRef.current?.hide();
      },
      show: ({ onConfirm }) => {
        setState({ onConfirm, loading: false });
        setClearCredentials(true);
        modalRef.current?.show();
      },
    }),
    [],
  );

  const handleConfirm = async () => {
    await state.onConfirm(clearCredentials);
    modalRef.current?.hide();
  };

  const handleCancel = () => {
    modalRef.current?.hide();
  };

  return (
    <Modal ref={modalRef}>
      <ModalHeader>Log Out</ModalHeader>
      <ModalBody className="wide pad">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={clearCredentials} onChange={e => setClearCredentials(e.target.checked)} />
          Delete stored credentials
        </label>
        <p className="mt-2 text-sm text-gray-400">
          This will remove all sensitive data, including <b>cloud provider credentials (AWS, GCP, Azure, HashiCorp)</b>,{' '}
          <b>GitHub and GitLab provider tokens</b>, <b>authenticated proxies</b>, and <b>AI Provider API keys</b> from
          your local storage. This will also disconnect authenticated Git repositories from your workspaces.
        </p>
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-4">
          <button type="button" className="btn" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            disabled={state.loading}
            style={{ color: 'var(--color-font-danger)', backgroundColor: 'var(--color-danger)' }}
            onClick={handleConfirm}
          >
            Log Out
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});

LogoutModal.displayName = 'LogoutModal';
