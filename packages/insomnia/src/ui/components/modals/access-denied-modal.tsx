import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import { useOrganizationPermissions } from '../../hooks/use-organization-features';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { showModal } from './index';

export interface AccessDeniedModalHandle {
  hide: () => void;
  show: () => void;
}
export const AccessDeniedModal = forwardRef<AccessDeniedModalHandle, ModalProps>((props, ref) => {
  const { billing } = useOrganizationPermissions();

  const modalRef = useRef<ModalHandle>(null);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: () => {
      modalRef.current?.show();
    },
  }), []);

  return (
    <Modal className='!z-10 h-[250px]' centered ref={modalRef} tall {...props}>
      <ModalHeader hideCloseButton>
        Access Denied
      </ModalHeader>
      <ModalBody noScroll>
        <p>
          {billing.expirationErrorMessage}
        </p>
        <a
          href="https://insomnia.rest/pricing/contact"
          className="mt-4 w-[120px] px-4 text-[--color-bg] bg-opacity-100 bg-[rgba(var(--color-font-rgb),var(--tw-bg-opacity))] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-sm hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        >
          Contact sales
        </a>
      </ModalBody>
    </Modal>
  );
});
AccessDeniedModal.displayName = 'AccessDeniedModal';
export const showAccessDeniedModal = () => showModal(AccessDeniedModal);
