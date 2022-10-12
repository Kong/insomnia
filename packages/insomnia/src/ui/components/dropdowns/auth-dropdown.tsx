import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import {
  AuthType,
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

const defaultTypes: AuthType[] = [
  'basic',
  'digest',
  'oauth1',
  'oauth2',
  'ntlm',
  'iam',
  'bearer',
  'hawk',
  'asap',
  'netrc',
];

function makeNewAuth(type: string, oldAuth: RequestAuthentication = {}): RequestAuthentication {
  switch (type) {
    // No Auth
    case 'none':
      return {};

    // HTTP Basic Authentication
    case 'basic':
      return {
        type,
        useISO88591: oldAuth.useISO88591 || false,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || '',
      };

    case 'digest':
    case 'ntlm':
      return {
        type,
        disabled: oldAuth.disabled || false,
        username: oldAuth.username || '',
        password: oldAuth.password || '',
      };

    case 'oauth1':
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
    case 'oauth2':
      return {
        type,
        grantType: GRANT_TYPE_AUTHORIZATION_CODE,
      };

    // Aws IAM
    case 'iam':
      return {
        type,
        disabled: oldAuth.disabled || false,
        accessKeyId: oldAuth.accessKeyId || '',
        secretAccessKey: oldAuth.secretAccessKey || '',
        sessionToken: oldAuth.sessionToken || '',
      };

    // Hawk
    case 'hawk':
      return {
        type,
        algorithm: HAWK_ALGORITHM_SHA256,
      };

    // Atlassian ASAP
    case 'asap':
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
    case 'netrc':
    default:
      return {
        type,
      };
  }
}

const AuthItem: FC<{
  type: AuthType;
  nameOverride?: string;
  isCurrent: (type: AuthType) => boolean;
  onClick: (type: AuthType) => void;
}> = ({ type, nameOverride, isCurrent, onClick }) => (
  <DropdownItem onClick={() => onClick(type)}>
    {<i className={`fa fa-${isCurrent(type) ? 'check' : 'empty'}`} />}{' '}
    {nameOverride || getAuthTypeName(type, true)}
  </DropdownItem>
);
AuthItem.displayName = DropdownItem.name;

interface Props {
  authTypes?: AuthType[];
  disabled?: boolean;
}
export const AuthDropdown: FC<Props> = ({ authTypes = defaultTypes, disabled = false }) => {
  const activeRequest = useSelector(selectActiveRequest);

  const onClick = useCallback(async (type: AuthType) => {
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
    update(activeRequest, { authentication: newAuthentication });
  }, [activeRequest]);
  const isCurrent = useCallback((type: AuthType) => {
    if (!activeRequest || !('authentication' in activeRequest)) {
      return false;
    }
    return type === (activeRequest.authentication.type || 'none');
  }, [activeRequest]);

  if (!activeRequest) {
    return null;
  }

  const itemProps = { onClick, isCurrent };

  return (
    <Dropdown beside>
      <DropdownDivider>Auth Types</DropdownDivider>
      <DropdownButton className="tall" disabled={disabled}>
        {'authentication' in activeRequest ? getAuthTypeName(activeRequest.authentication.type) || 'Auth' : 'Auth'}
        <i className="fa fa-caret-down space-left" />
      </DropdownButton>
      {authTypes.map(authType =>
        <AuthItem
          key={authType}
          type={authType}
          {...itemProps}
        />)}
      <DropdownDivider key="divider-other">
        Other
      </DropdownDivider>
      <AuthItem
        key="none"
        type="none"
        nameOverride="No Authentication"
        {...itemProps}
      />
    </Dropdown>
  );
};
