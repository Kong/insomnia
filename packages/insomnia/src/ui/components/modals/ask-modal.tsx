import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
interface State {
  title: string;
  message: React.ReactNode;
  yesText: string;
  noText: string;
  color: string;
  onDone?: (success: boolean) => Promise<void>;
  onHide?: () => void;
}
export interface AskModalOptions {
  title?: string;
  message: React.ReactNode;
  onDone?: (success: boolean) => Promise<void>;
  onHide?: () => void;
  yesText?: string;
  noText?: string;
  color?: string;
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
    color: 'surprise',
    onDone: async () => {},
  });

  useImperativeHandle(
    ref,
    () => ({
      hide: () => {
        modalRef.current?.hide();
      },
      show: ({ title, message, onDone, onHide, yesText, noText, color }) => {
        setState({
          title: title || 'Confirm',
          message: message || 'No message provided',
          yesText: yesText || 'Yes',
          noText: noText || 'No',
          color: color || 'surprise',
          onDone,
          onHide,
        });
        modalRef.current?.show();
      },
    }),
    [],
  );
  const { message, title, yesText, noText, color, onDone, onHide } = state;
  return (
    <Modal ref={modalRef} onHide={onHide}>
      <ModalHeader>{title || 'Confirm?'}</ModalHeader>
      <ModalBody className="wide pad">{message}</ModalBody>
      <ModalFooter>
        <div className="flex items-center gap-4">
          <button
            className="btn"
            onClick={() => {
              onDone?.(false);
              modalRef.current?.hide();
            }}
          >
            {noText}
          </button>
          <button
            className="btn"
            autoFocus
            style={{ color: `var(--color-font-${color})`, backgroundColor: `var(--color-${color})` }}
            onClick={() => {
              onDone?.(true);
              modalRef.current?.hide();
            }}
          >
            {yesText}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});
AskModal.displayName = 'AskModal';
