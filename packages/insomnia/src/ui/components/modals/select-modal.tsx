import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from '.';

export interface SelectModalOptions {
  message: string | null;
  onDone?: (selectedValue: string) => void | Promise<void>;
  options: {
    name: string;
    value: string;
  }[];
  title: string | null;
  value: string | null;
  noEscape?: boolean | false;
}
export interface SelectModalHandle {
  show: (options: SelectModalOptions) => void;
  hide: () => void;
}

export const SelectModal = forwardRef<SelectModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<SelectModalOptions>({
    message: null,
    options: [],
    title: null,
    value: null,
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      setState(options);
      modalRef.current?.show();
    },
  }), []);
  const { message, title, options, value, noEscape, onDone } = state;

  return (
    <Modal ref={modalRef} noEscape={noEscape}>
      <ModalHeader>{title || 'Confirm?'}</ModalHeader>
      <ModalBody className="wide pad">
        <p>{message}</p>
        <div className="form-control form-control--outlined">
          <select onChange={event => setState(state => ({ ...state, value: event.target.value }))} value={value ?? undefined}>
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
          Cancel
        </button>
        <button
          className="btn"
          onClick={() => {
            modalRef.current?.hide();
            onDone?.(value ?? '');
          }}
        >
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
SelectModal.displayName = 'SelectModal';

export const showSelectModal = (opts: SelectModalOptions) => showModal(SelectModal, opts);
