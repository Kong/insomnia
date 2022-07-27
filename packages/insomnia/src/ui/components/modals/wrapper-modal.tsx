import React, { forwardRef, ReactNode, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { type ModalProps, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { registerModal } from './index';

interface WrapperModalOptions {
  title: string;
  body: ReactNode;
  tall?: boolean;
  skinny?: boolean;
  wide?: boolean;
}
export interface WrapperModalHandle {
  show: (options: WrapperModalOptions) => void;
  hide: () => void;
}
export const displayName = 'WrapperModal';
export const WrapperModal = forwardRef<WrapperModalHandle, ModalProps>((props, ref) => {
  const modalRef = useRef<Modal>(null);
  const [state, setState] = useState<WrapperModalOptions>({
    title: '',
    body: null,
    tall: false,
    skinny: false,
    wide: false,
  });

  useEffect(() => {
    registerModal(modalRef.current, displayName);
  }, []);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      const { title, body, tall, skinny, wide } = options;
      setState({
        title,
        body,
        tall: !!tall,
        skinny: !!skinny,
        wide: !!wide,
      });
      modalRef.current?.show();
    },
  }), []);

  const { title, body, tall, skinny, wide } = state;

  return (
    <Modal ref={modalRef} tall={tall ?? undefined} skinny={skinny ?? undefined} wide={wide ?? undefined} {...props}>
      <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
      <ModalBody>{body}</ModalBody>
    </Modal>
  );

});
WrapperModal.displayName = displayName;
