import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, useCallback } from 'react';
import { Button, Collection, Header, ListBox, ListBoxItem, Popover, Section, Select, SelectValue } from 'react-aria-components';
import { useParams } from 'react-router-dom';

import {
  HAWK_ALGORITHM_SHA256,
} from '../../../common/constants';
import type { AuthTypeAPIKey, AuthTypeAwsIam, AuthTypeBasic, AuthTypeNTLM, AuthTypes, RequestAuthentication } from '../../../models/request';
import { getAuthObjectOrNull } from '../../../network/authentication';
import { SIGNATURE_METHOD_HMAC_SHA1 } from '../../../network/o-auth-1/constants';
import { GRANT_TYPE_AUTHORIZATION_CODE } from '../../../network/o-auth-2/constants';
import { useRequestGroupPatcher, useRequestPatcher } from '../../hooks/use-request';
import { Icon } from '../icon';

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
  const onClick = useCallback(async (type: AuthTypes | 'inherit') => {
    const clickedSameSetting = type === getAuthObjectOrNull(authentication)?.type || '';
    if (clickedSameSetting) {
      return;
    }
    const selectedInherit = type === 'inherit';
    const newAuthentication = selectedInherit ? {} : castOneAuthTypeToAnother(type, authentication || {});
    requestId && patchRequest(requestId, { authentication: newAuthentication });
    requestGroupId && patchRequestGroup(requestGroupId, { authentication: newAuthentication });
  }, [authentication, patchRequest, patchRequestGroup, requestGroupId, requestId]);

  const selectedAuthType = getAuthObjectOrNull(authentication)?.type || 'inherit';

  const authTypesItems: {
    id: AuthTypes;
    name: string;
  }[] = [
      {
      id: 'apikey',
      name: 'API Key',
      },
      {
        id: 'basic',
        name: 'Basic',
      },
      {
        id: 'digest',
        name: 'Digest',
      },
      {
        id: 'ntlm',
        name: 'NTLM',
      },
      {
        id: 'oauth1',
        name: 'OAuth 1.0',
      },
      {
        id: 'oauth2',
        name: 'OAuth 2.0',
      },
      {
        id: 'iam',
        name: 'AWS IAM',
      },
      {
        id: 'bearer',
        name: 'Bearer Token',
      },
      {
        id: 'hawk',
        name: 'Hawk',
      },
      {
        id: 'asap',
        name: 'Atlassian ASAP',
      },
      {
        id: 'netrc',
        name: 'Netrc',
      },
    ];

  const authTypeSections: {
    id: string;
    icon: IconName;
    name: string;
    items: {
      id: AuthTypes | 'inherit';
      name: string;
    }[];
  }[] = [
      {
        id: 'Other',
        name: 'Other',
        icon: 'ellipsis-h',
        items: [
          {
            id: 'inherit',
            name: 'Inherit from parent',
          },
          {
            id: 'none',
            name: 'None',
          },
        ],
      },
      {
        id: 'Auth Types',
        name: 'Auth Types',
        icon: 'lock',
        items: authTypesItems.filter(item => authTypes.includes(item.id)),
      },
    ];

  return (
    <Select
      isDisabled={disabled}
      aria-label="Change Authentication type"
      name="auth-type"
      onSelectionChange={authType => {
        onClick(authType as AuthTypes);
      }}
      selectedKey={selectedAuthType}
    >
      <Button className="px-4 min-w-[17ch] py-1 font-bold flex flex-1 items-center justify-between gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
        <SelectValue className="flex truncate items-center justify-center gap-2">
          {({ selectedText }) => (
            <div className='flex items-center gap-2 text-[--hl]'>
              {selectedText || 'Auth Type'}
            </div>
          )}
        </SelectValue>
        <Icon icon="caret-down" />
      </Button>
      <Popover className="min-w-max overflow-y-hidden flex flex-col">
        <ListBox
          items={authTypeSections}
          className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
        >
          {section => (
            <Section>
              <Header className='pl-2 py-1 flex items-center gap-2 text-[--hl] text-xs uppercase'>
                <Icon icon={section.icon} /> <span>{section.name}</span>
              </Header>
              <Collection items={section.items}>
                {item => (
                  <ListBoxItem
                    className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                    aria-label={item.name}
                    textValue={item.name}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>{item.name}</span>
                        {isSelected && (
                          <Icon
                            icon="check"
                            className="text-[--color-success] justify-self-end"
                          />
                        )}
                      </>
                    )}
                  </ListBoxItem>
                )}
              </Collection>
            </Section>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
};
