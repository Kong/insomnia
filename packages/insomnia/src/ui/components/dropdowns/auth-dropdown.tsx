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
  HAWK_ALGORITHM_SHA256,
} from '../../../common/constants';
import { update } from '../../../models/helpers/request-operations';
import { RequestAuthentication } from '../../../models/request';
import { SIGNATURE_METHOD_HMAC_SHA1 } from '../../../network/o-auth-1/constants';
import { GRANT_TYPE_AUTHORIZATION_CODE } from '../../../network/o-auth-2/constants';
import { selectActiveRequest } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';

function makeNewAuth(type: string, oldAuth: RequestAuthentication = {}): RequestAuthentication {
  switch (type) {
    // No Auth
    case AUTH_NONE:
      return {};

    // HTTP Basic Authentication
    case AUTH_BASIC:
      return {
        type,
        useISO88591: oldAuth.useISO88591 || false,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || '',
      };

    case AUTH_DIGEST:
    case AUTH_NTLM:
      return {
        type,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || '',
      };

    case AUTH_OAUTH_1:
      return {
        type,
        disabled: false,
        signatureMethod: SIGNATURE_METHOD_HMAC_SHA1,
        consumerKey: '',
        consumerSecret: '',
        tokenKey: '',
        tokenSecret: '',
        privateKey: '',
        version: '1.0',
        nonce: '',
        timestamp: '',
        callback: '',
      };

    // OAuth 2.0
    case AUTH_OAUTH_2:
      return {
        type,
        grantType: GRANT_TYPE_AUTHORIZATION_CODE,
      };

    // Aws IAM
    case AUTH_AWS_IAM:
      return {
        type,
        disabled: oldAuth.disabled || false,
        accessKeyId: oldAuth.accessKeyId || '',
        secretAccessKey: oldAuth.secretAccessKey || '',
        sessionToken: oldAuth.sessionToken || '',
      };

    // Hawk
    case AUTH_HAWK:
      return {
        type,
        algorithm: HAWK_ALGORITHM_SHA256,
      };

    // Atlassian ASAP
    case AUTH_ASAP:
      return {
        type,
        issuer: '',
        subject: '',
        audience: '',
        additionalClaims: '',
        keyId: '',
        privateKey: '',
      };

    // Types needing no defaults
    case AUTH_NETRC:
    default:
      return {
        type,
      };
  }
}

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

export const AuthDropdown: FC = () => {
  const activeRequest = useSelector(selectActiveRequest);

  const onClick = useCallback(async (type: string) => {
    if (!activeRequest || !('authentication' in activeRequest)) {
      return;
    }

    const { authentication } = activeRequest;

    if (type === authentication.type) {
      // Type didn't change
      return;
    }

    const newAuthentication = makeNewAuth(type, authentication);
    const defaultAuthentication = makeNewAuth(authentication.type);

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
    update(activeRequest, { authentication:newAuthentication });
  }, [activeRequest]);
  const isCurrent = useCallback((type: string) => {
    if (!activeRequest || !('authentication' in activeRequest)) {
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
