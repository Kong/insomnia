import React, { FC, ReactElement, useCallback } from 'react';

import { AuthType, getAuthTypeName } from '../../../common/constants';
import * as models from '../../../models';
import { update } from '../../../models/helpers/request-operations';
import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
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
  'none',
];

const AuthItem: FC<{
  type: AuthType;
  nameOverride?: string;
  isCurrent: (type: string) => boolean;
  onClick: (type: AuthType) => void;
}> = ({ type, nameOverride, isCurrent, onClick }) => (
  <DropdownItem onClick={onClick} value={type}>
    {<i className={`fa fa-${isCurrent(type) ? 'check' : 'empty'}`} />}{' '}
    {nameOverride || getAuthTypeName(type, true)}
  </DropdownItem>
);
AuthItem.displayName = DropdownItem.name;

interface Props {
  authTypes?: AuthType[];
  request: WebSocketRequest;
}
export const AuthDropdown: FC<Props> = ({ authTypes = defaultTypes, request }) => {
  const onClick = useCallback(async (type: AuthType) => {
    if (!request) {
      return;
    }

    if (!isWebSocketRequest(request)) {
      return;
    }

    const { authentication } = request;
    console.log('authentication', authentication);
    if (type === authentication.type) {
      // Type didn't change
      return;
    }

    const newAuthentication = models.websocketRequest.newAuth(type, authentication);
    const defaultAuthentication = models.websocketRequest.newAuth(authentication.type);

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
    update(request, { authentication:newAuthentication });
  }, [request]);
  const isCurrent = useCallback((type: string) => {
    if (!request) {
      return false;
    }
    if (!isWebSocketRequest(request)) {
      return false;
    }
    return type === (request.authentication?.type || 'none');
  }, [request]);

  if (!request) {
    return null;
  }

  const itemProps = { onClick, isCurrent };

  return (
    <Dropdown beside>
      <DropdownDivider>Auth Types</DropdownDivider>
      <DropdownButton className="tall">
        {'authentication' in request ? getAuthTypeName(request.authentication.type) || 'Auth' : 'Auth'}
        <i className="fa fa-caret-down space-left" />
      </DropdownButton>
      {authTypes.reduce<ReactElement[]>((acc: ReactElement[], authType: AuthType) => {
        if (authType === 'none') {
          return acc.concat([
            <DropdownDivider key="divider-other">
              Other
            </DropdownDivider>,
            <AuthItem
              key={authType}
              type={authType}
              nameOverride="No Authentication"
              {...itemProps}
            />,
          ]);
        }

        return acc.concat(<AuthItem key={authType} type={authType} {...itemProps} />);
      }, [])}
    </Dropdown>
  );
};
