import React, { useCallback } from 'react';

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
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';

interface Props {
  className?: string;
  onChange: (r: Request, arg1: RequestAuthentication) => Promise<Request>;
  request: Request;
}

export const AuthDropdown: React.FC<Props> = ({ children, className, onChange, request }) => {
  const { authentication } = request;
  const renderAuthType = (type: string, nameOverride: string | null = null) => {
    const currentType = authentication.type || AUTH_NONE;
    return (
      <DropdownItem onClick={handleTypeChange} value={type}>
        {<i className={`fa fa-${currentType === type ? 'check' : 'empty'}`} />}{' '}
        {nameOverride || getAuthTypeName(type, true)}
      </DropdownItem>
    );
  };
  const handleTypeChange = useCallback(async (type: string) => {
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
    onChange(request, newAuthentication);
  }, [authentication, onChange, request]);
  return (
    <Dropdown
      beside
      // @ts-expect-error -- TSCONVERSION appears to be genuine
      debug="true"
    >
      <DropdownDivider>Auth Types</DropdownDivider>
      <DropdownButton className={className}>{children}</DropdownButton>
      {renderAuthType(AUTH_BASIC)}
      {renderAuthType(AUTH_DIGEST)}
      {renderAuthType(AUTH_OAUTH_1)}
      {renderAuthType(AUTH_OAUTH_2)}
      {renderAuthType(AUTH_NTLM)}
      {renderAuthType(AUTH_AWS_IAM)}
      {renderAuthType(AUTH_BEARER)}
      {renderAuthType(AUTH_HAWK)}
      {renderAuthType(AUTH_ASAP)}
      {renderAuthType(AUTH_NETRC)}
      <DropdownDivider>Other</DropdownDivider>
      {renderAuthType(AUTH_NONE, 'No Authentication')}
    </Dropdown>
  );
};
