import React, { type FC, useEffect, useRef, useState } from 'react';

import type { OAuth2AuthorizationStatusType } from '../../../network/o-auth-2/constants';
import uiEventBus, { OAUTH2_AUTHORIZATION_STATUS_CHANGE } from '../../eventBus';
import { Modal, type ModalHandle } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

const statusTextMap: Record<OAuth2AuthorizationStatusType, string> = {
  none: 'Not in Authorization',
  getting_code: 'See your browser to finish authorization ...',
  getting_token: 'Getting access token ...',
};

export const OAuthAuthorizationStatusModal: FC = () => {
  const [status, setStatus] = useState<OAuth2AuthorizationStatusType>('none');

  useEffect(() => {
    const handleStatusChange = ({ status: newStatus }: { status: OAuth2AuthorizationStatusType }) => {
      setStatus(newStatus);
    };
    uiEventBus.on(OAUTH2_AUTHORIZATION_STATUS_CHANGE, handleStatusChange);
    return () => {
      uiEventBus.off(OAUTH2_AUTHORIZATION_STATUS_CHANGE, handleStatusChange);
    };
  }, []);

  const modalRef = useRef<ModalHandle>(null);
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  useEffect(() => {
    if (status === 'none') {
      modalRef.current?.hide();
    } else if (status === 'getting_code') {
      modalRef.current?.show();
    }
  }, [status]);

  return (
    <Modal centered ref={modalRef}>
      <ModalHeader>OAuth 2.0 Authorization</ModalHeader>
      <ModalBody>{statusTextMap[status]}</ModalBody>
    </Modal>
  );
};
