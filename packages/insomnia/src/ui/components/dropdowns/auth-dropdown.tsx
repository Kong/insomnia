import React, { FC, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import {
  getAuthTypeName,
  HAWK_ALGORITHM_SHA256,
} from '../../../common/constants';
import type { AuthTypeAPIKey, AuthTypeAwsIam, AuthTypeBasic, AuthTypeNTLM, AuthTypes, RequestAuthentication } from '../../../models/request';
import { getAuthObjectOrNull } from '../../../network/authentication';
import { SIGNATURE_METHOD_HMAC_SHA1 } from '../../../network/o-auth-1/constants';
import { GRANT_TYPE_AUTHORIZATION_CODE } from '../../../network/o-auth-2/constants';
import { useRequestGroupPatcher, useRequestPatcher } from '../../hooks/use-request';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';

function castOneAuthTypeToAnother(type: AuthTypes, oldAuth: RequestAuthentication | {}): RequestAuthentication {
  switch (type) {
    // No Auth
    case 'none':
      return { type: 'none' };

    // API Key Authentication
    case 'apikey':
      const oldApikey = oldAuth as AuthTypeAPIKey;
      return {
        type,
        disabled: oldApikey.disabled || false,
        key: oldApikey.key || '',
        value: oldApikey.value || '',
        addTo: oldApikey.addTo || 'header',
      };

    // HTTP Basic Authentication
    case 'basic':
      const oldBasic = oldAuth as AuthTypeBasic;
      return {
        type,
        useISO88591: oldBasic.useISO88591 || false,
        disabled: oldBasic.disabled || false,
        username: oldBasic.username || '',
        password: oldBasic.password || '',
      };

    case 'digest':
    case 'ntlm':
      const oldNtlm = oldAuth as AuthTypeNTLM;
      return {
        type,
        disabled: oldNtlm.disabled || false,
        username: oldNtlm.username || '',
        password: oldNtlm.password || '',
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
      const oldIam = oldAuth as AuthTypeAwsIam;
      return {
        type,
        disabled: oldIam.disabled || false,
        accessKeyId: oldIam.accessKeyId || '',
        secretAccessKey: oldIam.secretAccessKey || '',
        sessionToken: oldIam.sessionToken || '',
      };

    // Hawk
    case 'hawk':
      return {
        type,
        algorithm: HAWK_ALGORITHM_SHA256,
        id: '',
        key: '',
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

const defaultTypes: AuthTypes[] = [
  'apikey',
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

interface Props {
  authentication?: RequestAuthentication | {};
  authTypes?: AuthTypes[];
  disabled?: boolean;
}
export const AuthDropdown: FC<Props> = ({ authentication, authTypes = defaultTypes, disabled = false }) => {
  const { requestId, requestGroupId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId?: string; requestGroupId?: string };
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const onClick = useCallback(async (type?: AuthTypes) => {
    const clickedSameSetting = type === getAuthObjectOrNull(authentication)?.type;
    if (clickedSameSetting) {
      return;
    }
    const newAuthentication = type ? castOneAuthTypeToAnother(type, authentication || {}) : {};
    requestId && patchRequest(requestId, { authentication: newAuthentication });
    requestGroupId && patchRequestGroup(requestGroupId, { authentication: newAuthentication });
  }, [authentication, patchRequest, patchRequestGroup, requestGroupId, requestId]);

  const isSelected = useCallback((type: AuthTypes) => {
    return type === getAuthObjectOrNull(authentication)?.type;
  }, [authentication]);

  return (
    <Dropdown
      aria-label='Authentication Dropdown'
      isDisabled={disabled}
      triggerButton={
        <DropdownButton className="tall !text-[--hl]">
          {getAuthTypeName(getAuthObjectOrNull(authentication)?.type)}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
      }
    >
      <DropdownSection
        aria-label='Auth types section'
        title="Auth Types"
      >
        {authTypes.map(authType =>
          <DropdownItem
            key={authType}
            aria-label={getAuthTypeName(authType, true)}
          >
            <ItemContent
              icon={isSelected(authType) ? 'check' : 'empty'}
              label={getAuthTypeName(authType, true)}
              onClick={() => onClick(authType)}
            />
          </DropdownItem>
        )}
      </DropdownSection>
      <DropdownSection
        aria-label="Other types section"
        title="Other"
      >
        <DropdownItem aria-label='None' key="none">
          <ItemContent
            icon={isSelected('none') ? 'check' : 'empty'}
            label={'No Authentication'}
            onClick={() => onClick('none')}
          />
        </DropdownItem>
        <DropdownItem aria-label='Inherit from parent' key="inherit">
          <ItemContent
            icon={getAuthObjectOrNull(authentication) === null ? 'check' : 'empty'}
            label={'Inherit from parent'}
            onClick={() => onClick()}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
