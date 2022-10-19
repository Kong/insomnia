import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
interface State {
  title: string;
  message: string;
  yesText: string;
  noText: string;
  loading: boolean;
  onDone?: (success: boolean) => Promise<void>;
}
export interface AskModalOptions {
  title?: string;
  message?: string;
  onDone?: (success: boolean) => Promise<void>;
  yesText?: string;
  noText?: string;
}
export interface AskModalHandle {
  show: (options: AskModalOptions) => void;
  hide: () => void;
}
export const AskModal = forwardRef<AskModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    title: '',
    message: '',
    yesText: 'Yes',
    noText: 'No',
    loading: false,
    onDone: async () => {},
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({ title, message, onDone, yesText, noText }) => {
      setState({
        title: title || 'Confirm',
        message: message || 'No message provided',
        yesText: yesText || 'Yes',
        noText: noText || 'No',
        loading: false,
        onDone,
      });
      modalRef.current?.show();
    },
  }), []);
  const { message, title, yesText, noText, loading, onDone } = state;
  return (
    <Modal ref={modalRef} noEscape>
      <ModalHeader>{title || 'Confirm?'}</ModalHeader>
      <ModalBody className="wide pad">{message}</ModalBody>
      <ModalFooter>
        <div>
          <button
            className="btn"
            onClick={() => {
              modalRef.current?.hide();
              onDone?.(false);
            }}
          >
            {noText}
          </button>
          <button
            className="btn"
            onClick={async () => {
              setState({
                ...state,
                loading: true,
              });
              await onDone?.(true);
              modalRef.current?.hide();
            }}
            disabled={loading}
          >
            {loading && <i className="fa fa-refresh fa-spin" />} {yesText}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});
AskModal.displayName = 'AskModal';
