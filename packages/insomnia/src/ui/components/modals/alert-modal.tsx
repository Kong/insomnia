import React, { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from 'react';

import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

export interface AlertModalOptions {
  title?: string;
  message?: ReactNode;
  addCancel?: boolean;
  okLabel?: React.ReactNode;
  onConfirm?: () => void | Promise<void>;
}
export interface AlertModalHandle {
  show: (options: AlertModalOptions) => void;
  hide: () => void;
}
export const AlertModal = forwardRef<AlertModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<AlertModalOptions>({
    title: '',
    message: '',
    addCancel: false,
    okLabel: '',
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({ title, message, addCancel, onConfirm, okLabel }) => {
      setState({
        title,
        message,
        addCancel,
        okLabel,
        onConfirm,
      });
      modalRef.current?.show();
    },
  }), []);

  const { message, title, addCancel, okLabel } = state;
  return (
    <Modal ref={modalRef} skinny>
      <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
      <ModalBody className="wide pad">{message}</ModalBody>
      <ModalFooter>
        <div>
          {addCancel ? (
            <button className="btn" onClick={() => modalRef.current?.hide()}>
              Cancel
            </button>
          ) : null}
          <button
            className="btn"
            onClick={() => {
              modalRef.current?.hide();
              if (typeof state.onConfirm === 'function') {
                state.onConfirm();
              }
            }}
          >
            {okLabel || 'Ok'}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});
AlertModal.displayName = 'AlertModal';
