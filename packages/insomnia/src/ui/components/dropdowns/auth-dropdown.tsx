import React, { FC, useCallback } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import {
  getAuthTypeName,
  HAWK_ALGORITHM_SHA256,
} from '../../../common/constants';
import type { AuthTypeAPIKey, AuthTypeAwsIam, AuthTypeBasic, AuthTypeNTLM, AuthTypes, RequestAuthentication } from '../../../models/request';
import { SIGNATURE_METHOD_HMAC_SHA1 } from '../../../network/o-auth-1/constants';
import { GRANT_TYPE_AUTHORIZATION_CODE } from '../../../network/o-auth-2/constants';
import { useRequestPatcher } from '../../hooks/use-request';
import { RequestLoaderData } from '../../routes/request';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';

function castOneAuthTypeToAnother(type: AuthTypes, oldAuth: RequestAuthentication = { type: 'none' }): RequestAuthentication {
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
  authTypes?: AuthTypes[];
  disabled?: boolean;
}
export const AuthDropdown: FC<Props> = ({ authTypes = defaultTypes, disabled = false }) => {
  const { activeRequest } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const { requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const patchRequest = useRequestPatcher();
  const onClick = useCallback(async (type: AuthTypes) => {
    if (!activeRequest || !('authentication' in activeRequest)) {
      return;
    }

    const authentication = activeRequest.authentication as RequestAuthentication;

    if (type === authentication.type) {
      // Type didn't change
      return;
    }

    const newAuthentication = castOneAuthTypeToAnother(type, authentication);
    const defaultAuthentication = castOneAuthTypeToAnother(authentication.type);

    // Prompt the user if fields will change between new and old
    for (const key of Object.keys(authentication)) {
      if (key === 'type') {
        continue;
      }

      // @ts-expect-error -- garbage abstraction
      const value = authentication[key];
      // @ts-expect-error -- garbage abstraction
      const changedSinceDefault = defaultAuthentication[key] !== value;
      // @ts-expect-error -- garbage abstraction
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
    patchRequest(requestId, { authentication: newAuthentication });
  }, [activeRequest, patchRequest, requestId]);
  const isCurrent = useCallback((type: AuthTypes) => {
    if (!activeRequest || !('authentication' in activeRequest)) {
      return false;
    }
    const authentication = activeRequest.authentication as RequestAuthentication;

    return type === (authentication.type || 'none');
  }, [activeRequest]);

  if (!activeRequest) {
    return null;
  }
  const authentication = activeRequest.authentication as RequestAuthentication;

  return (
    <Dropdown
      aria-label='Authentication Dropdown'
      isDisabled={disabled}
      triggerButton={
        <DropdownButton className="tall !text-[--hl]">
          {'authentication' in activeRequest ? getAuthTypeName(authentication.type) || 'Auth' : 'Auth'}
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
              icon={isCurrent(authType) ? 'check' : 'empty'}
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
            icon={isCurrent('none') ? 'check' : 'empty'}
            label={'No Authentication'}
            onClick={() => onClick('none')}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
