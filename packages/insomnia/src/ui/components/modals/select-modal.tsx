import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from '.';

const FORM_ID = 'select-modal-form';

export interface SelectModalOptions {
  message: string | null;
  onDone?: (selectedValue: string | null) => void | Promise<void>;
  options: {
    name: string;
    value: string;
  }[];
  title: string | null;
  value: string | null;
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

  useImperativeHandle(
    ref,
    () => ({
      hide: () => {
        modalRef.current?.hide();
      },
      show: options => {
        setState(options);
        modalRef.current?.show();
      },
    }),
    [],
  );
  const { message, title, options, value, onDone } = state;

  const handleDone = () => {
    modalRef.current?.hide();
    onDone?.(value);
  };

  return (
    <Modal ref={modalRef}>
      <ModalHeader>{title || 'Confirm?'}</ModalHeader>
      <ModalBody className="wide pad" data-testid="global-select-modal">
        <p>{message}</p>
        <form
          id={FORM_ID}
          className="form-control form-control--outlined"
          onSubmit={e => {
            e.preventDefault();
            handleDone();
          }}
        >
          <select
            autoFocus
            onChange={event => setState(state => ({ ...state, value: event.target.value }))}
            value={value ?? undefined}
          >
            {options.map(({ name, value }) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </form>
      </ModalBody>
      <ModalFooter>
        <button type="submit" form={FORM_ID} className="btn">
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
SelectModal.displayName = 'SelectModal';

export const showSelectModal = (opts: SelectModalOptions) => showModal(SelectModal, opts);
