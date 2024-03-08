import React, { FC, useCallback } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import {
  AuthType,
  getAuthTypeName,
} from '../../../common/constants';
import { useRequestPatcher } from '../../hooks/use-request';
import { RequestLoaderData } from '../../routes/request';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { makeNewAuth } from './transformAuthToAnotherType';

const defaultTypes: AuthType[] = [
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
  authTypes?: AuthType[];
  disabled?: boolean;
}
export const AuthDropdown: FC<Props> = ({ authTypes = defaultTypes, disabled = false }) => {
  const { activeRequest } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const { requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const patchRequest = useRequestPatcher();
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
  const isCurrent = useCallback((type: AuthType) => {
    if (!activeRequest || !('authentication' in activeRequest)) {
      return false;
    }
    return type === (activeRequest.authentication.type || 'none');
  }, [activeRequest]);

  if (!activeRequest) {
    return null;
  }

  return (
    <Dropdown
      aria-label='Authentication Dropdown'
      isDisabled={disabled}
      triggerButton={
        <DropdownButton className="tall !text-[--hl]">
          {'authentication' in activeRequest ? getAuthTypeName(activeRequest.authentication.type) || 'Auth' : 'Auth'}
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
