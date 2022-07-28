import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { registerModal, showModal } from '.';

export interface SelectModalOptions {
  message: string | null;
  onCancel?: () => void;
  onDone?: (selectedValue: string | null) => void | Promise<void>;
  options: {
    name: string;
    value: string;
  }[];
  title: string | null;
  value: string | null;
  noEscape?: boolean;
}
export interface SelectModalHandle {
  show: (options: SelectModalOptions) => void;
  hide: () => void;
}
export const displayName = 'SelectModal';
export const SelectModal = forwardRef<SelectModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<Modal>(null);
  const [state, setState] = useState<SelectModalOptions>({
    message: null,
    options: [],
    title: null,
    value: null,
  });

  useEffect(() => {
    registerModal(modalRef.current, displayName);
  }, []);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      setState(options);
      modalRef.current?.show();
    },
  }), []);
  const _handleSelectChange = (event: React.SyntheticEvent<HTMLSelectElement>) => {
    setState({ message, title, options, onCancel, noEscape, value: event.currentTarget.value });
  };
  const { message, title, options, value, onCancel, noEscape } = state;

  return (
    <Modal ref={modalRef} onCancel={onCancel} noEscape={noEscape}>
      <ModalHeader>{title || 'Confirm?'}</ModalHeader>
      <ModalBody className="wide pad">
        <p>{message}</p>
        <div className="form-control form-control--outlined">
          <select onChange={_handleSelectChange} value={value ?? undefined}>
            {options.map(({ name, value }) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
SelectModal.displayName = displayName;

export const showSelectModal = (opts: SelectModalOptions) => showModal(SelectModal, opts);
