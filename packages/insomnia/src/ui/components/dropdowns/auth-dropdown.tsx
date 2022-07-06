import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import {
  AUTH_ASAP,
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_BEARER,
  AUTH_DIGEST,
  AUTH_HAWK,
  AUTH_NETRC,
  AUTH_NONE,
  AUTH_NTLM,
  AUTH_OAUTH_1,
  AUTH_OAUTH_2,
  getAuthTypeName,
} from '../../../common/constants';
import * as models from '../../../models';
import type { Request, RequestAuthentication } from '../../../models/request';
import { selectActiveRequest } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';

const AuthItem: FC<{
  type: string;
  nameOverride?: string;
  isCurrent: (type: string) => boolean;
  onClick: (type: string) => void;
}> = ({ type, nameOverride, isCurrent, onClick }) => (
  <DropdownItem onClick={onClick} value={type}>
    {<i className={`fa fa-${isCurrent(type) ? 'check' : 'empty'}`} />}{' '}
    {nameOverride || getAuthTypeName(type, true)}
  </DropdownItem>
);
AuthItem.displayName = DropdownItem.name;

interface Props {
  onChange: (request: Request, arg1: RequestAuthentication) => Promise<Request>;
}

export const AuthDropdown: FC<Props> = ({ onChange }) => {
  const activeRequest = useSelector(selectActiveRequest);

  const onClick = useCallback(async (type: string) => {
    if (!activeRequest) {
      return;
    }

    if (!('authentication' in activeRequest)) {
      // gRPC Requests don't have `authentication`
      return;
    }

    const { authentication } = activeRequest;

    if (type === authentication.type) {
      // Type didn't change
      return;
    }

    const newAuthentication = models.request.newAuth(type, authentication);
    const defaultAuthentication = models.request.newAuth(authentication.type);

    // Prompt the user if fields will change between new and old
    for (const key of Object.keys(authentication)) {
      if (key === 'type') {
        continue;
      }

      const value = authentication[key];
      const changedSinceDefault = defaultAuthentication[key] !== value;
      const willChange = newAuthentication[key] !== value;

      if (changedSinceDefault && willChange) {
        await showModal(AlertModal, {
          title: 'Switch Authentication?',
          message: 'Current authentication settings will be lost',
          addCancel: true,
        });
        break;
      }
    }
    onChange(activeRequest, newAuthentication);
  }, [onChange, activeRequest]);

  const isCurrent = useCallback((type: string) => {
    if (!activeRequest) {
      return false;
    }
    if (!('authentication' in activeRequest)) {
      return false;
    }
    return type === (activeRequest.authentication.type || AUTH_NONE);
  }, [activeRequest]);

  if (!activeRequest) {
    return null;
  }

  const itemProps = { onClick, isCurrent };

  return (
    <Dropdown beside>
      <DropdownDivider>Auth Types</DropdownDivider>
      <DropdownButton className="tall">
        {'authentication' in activeRequest ? getAuthTypeName(activeRequest.authentication.type) || 'Auth' : 'Auth'}
        <i className="fa fa-caret-down space-left" />
      </DropdownButton>
      <AuthItem type={AUTH_BASIC} {...itemProps} />
      <AuthItem type={AUTH_DIGEST} {...itemProps} />
      <AuthItem type={AUTH_OAUTH_1} {...itemProps} />
      <AuthItem type={AUTH_OAUTH_2} {...itemProps} />
      <AuthItem type={AUTH_NTLM} {...itemProps} />
      <AuthItem type={AUTH_AWS_IAM} {...itemProps} />
      <AuthItem type={AUTH_BEARER} {...itemProps} />
      <AuthItem type={AUTH_HAWK} {...itemProps} />
      <AuthItem type={AUTH_ASAP} {...itemProps} />
      <AuthItem type={AUTH_NETRC} {...itemProps} />
      <DropdownDivider>Other</DropdownDivider>
      <AuthItem type={AUTH_NONE} nameOverride="No Authentication" {...itemProps} />
    </Dropdown>
  );
};
