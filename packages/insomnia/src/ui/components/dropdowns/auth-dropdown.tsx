import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, useCallback } from 'react';
import {
  Button,
  Collection,
  Header,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components';
import { useParams } from 'react-router';

import { type AuthTypes, HAWK_ALGORITHM_SHA256 } from '../../../common/constants';
import type {
  AuthTypeAPIKey,
  AuthTypeAwsIam,
  AuthTypeBasic,
  AuthTypeNTLM,
  RequestAuthentication,
} from '../../../models/request';
import { getAuthObjectOrNull } from '../../../network/authentication';
import { SIGNATURE_METHOD_HMAC_SHA1 } from '../../../network/o-auth-1/constants';
import { GRANT_TYPE_AUTHORIZATION_CODE } from '../../../network/o-auth-2/constants';
import { useRequestGroupPatcher, useRequestPatcher } from '../../hooks/use-request';
import { Icon } from '../icon';

function castOneAuthTypeToAnother(type: AuthTypes, oldAuth: RequestAuthentication | {}): RequestAuthentication {
  if (type === 'none') {
    return { type: 'none' };
  }

  if (type === 'apikey') {
    const oldApikey = oldAuth as AuthTypeAPIKey;
    return {
      type,
      disabled: oldApikey.disabled || false,
      key: oldApikey.key || '',
      value: oldApikey.value || '',
      addTo: oldApikey.addTo || 'header',
    };
  }

  if (type === 'basic') {
    const oldBasic = oldAuth as AuthTypeBasic;
    return {
      type,
      useISO88591: oldBasic.useISO88591 || false,
      disabled: oldBasic.disabled || false,
      username: oldBasic.username || '',
      password: oldBasic.password || '',
    };
  }

  if (type === 'digest' || type === 'ntlm') {
    const oldNtlm = oldAuth as AuthTypeNTLM;
    return {
      type,
      disabled: oldNtlm.disabled || false,
      username: oldNtlm.username || '',
      password: oldNtlm.password || '',
    };
  }

  if (type === 'oauth1') {
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
  }

  if (type === 'oauth2') {
    return {
      type,
      grantType: GRANT_TYPE_AUTHORIZATION_CODE,
    };
  }

  if (type === 'iam') {
    const oldIam = oldAuth as AuthTypeAwsIam;
    return {
      type,
      disabled: oldIam.disabled || false,
      accessKeyId: oldIam.accessKeyId || '',
      secretAccessKey: oldIam.secretAccessKey || '',
      sessionToken: oldIam.sessionToken || '',
    };
  }

  if (type === 'hawk') {
    return {
      type,
      algorithm: HAWK_ALGORITHM_SHA256,
      id: '',
      key: '',
    };
  }

  if (type === 'asap') {
    return {
      type,
      issuer: '',
      subject: '',
      audience: '',
      additionalClaims: '',
      keyId: '',
      privateKey: '',
    };
  }

  // Types needing no defaults
  return {
    type,
  };
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
  hideOthers?: boolean;
  hideInherit?: boolean;
}

export const AuthDropdown: FC<Props> = ({
  authentication,
  authTypes = defaultTypes,
  disabled = false,
  hideOthers = false,
  hideInherit = false,
}) => {
  const { requestId, requestGroupId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId?: string;
    requestGroupId?: string;
  };
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const onClick = useCallback(
    async (type: AuthTypes | 'inherit') => {
      const clickedSameSetting = type === getAuthObjectOrNull(authentication)?.type || '';
      if (clickedSameSetting) {
        return;
      }
      const selectedInherit = type === 'inherit';
      const newAuthentication = selectedInherit ? {} : castOneAuthTypeToAnother(type, authentication || {});
      requestId && patchRequest(requestId, { authentication: newAuthentication });
      requestGroupId && patchRequestGroup(requestGroupId, { authentication: newAuthentication });
    },
    [authentication, patchRequest, patchRequestGroup, requestGroupId, requestId],
  );

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
    {
      id: 'singleToken',
      name: 'token',
    },
  ];

  interface Section {
    id: string;
    icon: IconName;
    name: string;
    items: {
      id: AuthTypes | 'inherit';
      name: string;
    }[];
  }

  const commonSections: Section = {
    id: 'Auth Types',
    name: 'Auth Types',
    icon: 'lock',
    items: authTypesItems.filter(item => authTypes.includes(item.id)),
  };

  const authTypeSections: Section[] = hideOthers
    ? [commonSections]
    : [
        {
          id: 'Other',
          name: 'Other',
          icon: 'ellipsis-h',
          items: [
            ...(hideInherit
              ? []
              : [
                  {
                    id: 'inherit',
                    name: 'Inherit from parent',
                  } as const,
                ]),
            {
              id: 'none',
              name: 'None',
            },
          ],
        },
        commonSections,
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
      <Button className="flex min-w-[17ch] flex-1 items-center justify-between gap-2 rounded-sm px-4 py-1 text-sm font-bold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]">
        <SelectValue className="flex items-center justify-center gap-2 truncate">
          {({ selectedText }) => (
            <div className="flex items-center gap-2 text-[--hl]">{selectedText || 'Auth Type'}</div>
          )}
        </SelectValue>
        <Icon icon="caret-down" />
      </Button>
      <Popover className="flex min-w-[17ch] flex-col overflow-y-hidden">
        <ListBox
          items={authTypeSections}
          className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
        >
          {section => (
            <ListBoxSection>
              <Header className="flex items-center gap-2 py-1 pl-2 text-xs uppercase text-[--hl]">
                <Icon icon={section.icon} /> <span>{section.name}</span>
              </Header>
              <Collection items={section.items}>
                {item => (
                  <ListBoxItem
                    className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                    aria-label={item.name}
                    textValue={item.name}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>{item.name}</span>
                        {isSelected && <Icon icon="check" className="justify-self-end text-[--color-success]" />}
                      </>
                    )}
                  </ListBoxItem>
                )}
              </Collection>
            </ListBoxSection>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
};
