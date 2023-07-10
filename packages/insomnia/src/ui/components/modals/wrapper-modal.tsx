import React, { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from 'react';

import { Modal, ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

interface WrapperModalOptions {
  title: ReactNode;
  body: ReactNode;
  tall?: boolean;
  skinny?: boolean;
  wide?: boolean;
}
export interface WrapperModalHandle {
  show: (options: WrapperModalOptions) => void;
  hide: () => void;
}
export const WrapperModal = forwardRef<WrapperModalHandle, ModalProps>((props, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<WrapperModalOptions>({
    title: '',
    body: null,
    tall: false,
    skinny: false,
    wide: false,
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

  const { title, body, tall, skinny, wide } = state;

  return (
    <Modal ref={modalRef} tall={tall} skinny={skinny} wide={wide} {...props}>
      <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
      <ModalBody>{body}</ModalBody>
    </Modal>
  );

});
WrapperModal.displayName = 'WrapperModal';
