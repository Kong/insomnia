import React, { type FC, type ReactNode } from 'react';
import { Toolbar } from 'react-aria-components';

import type { AuthTypes } from '~/common/constants';
import { SingleTokenAuth } from '~/ui/components/editors/auth/single-token-auth';

import type { RequestAuthentication } from '../../../../models/request';
import { getAuthObjectOrNull } from '../../../../network/authentication';
import { AuthDropdown } from '../../dropdowns/auth-dropdown';
import { ApiKeyAuth } from './api-key-auth';
import { AsapAuth } from './asap-auth';
import { AWSAuth } from './aws-auth';
import { BasicAuth } from './basic-auth';
import { BearerAuth } from './bearer-auth';
import { DigestAuth } from './digest-auth';
import { HawkAuth } from './hawk-auth';
import { NetrcAuth } from './netrc-auth';
import { NTLMAuth } from './ntlm-auth';
import { OAuth1Auth } from './o-auth-1-auth';
import { OAuth2Auth } from './o-auth-2-auth';

export const AuthWrapper: FC<{
  authentication?: RequestAuthentication | {};
  disabled?: boolean;
  authTypes?: AuthTypes[];
  hideOthers?: boolean;
  hideInherit?: boolean;
  showMcpAuthFlow?: boolean;
  addToHeaderOnly?: boolean;
}> = ({ authentication, disabled = false, authTypes, hideOthers, hideInherit, showMcpAuthFlow, addToHeaderOnly }) => {
  const type = getAuthObjectOrNull(authentication)?.type || '';
  let authBody: ReactNode = null;

  if (type === 'basic') {
    authBody = <BasicAuth disabled={disabled} />;
  } else if (type === 'apikey') {
    authBody = <ApiKeyAuth disabled={disabled} addToHeaderOnly={addToHeaderOnly} />;
  } else if (type === 'oauth2') {
    authBody = <OAuth2Auth showMcpAuthFlow={showMcpAuthFlow} disabled={disabled} />;
  } else if (type === 'hawk') {
    authBody = <HawkAuth />;
  } else if (type === 'oauth1') {
    authBody = <OAuth1Auth />;
  } else if (type === 'digest') {
    authBody = <DigestAuth disabled={disabled} />;
  } else if (type === 'ntlm') {
    authBody = <NTLMAuth />;
  } else if (type === 'bearer') {
    authBody = <BearerAuth disabled={disabled} />;
  } else if (type === 'iam') {
    authBody = <AWSAuth />;
  } else if (type === 'netrc') {
    authBody = <NetrcAuth />;
  } else if (type === 'asap') {
    authBody = <AsapAuth />;
  } else if (type === 'singleToken') {
    authBody = <SingleTokenAuth disabled={disabled} />;
  } else {
    authBody = (
      <div className="flex h-full w-full items-center justify-center select-none">
        <p className="p-4 text-center text-sm text-(--hl)">
          <i
            className="fa fa-unlock-alt"
            style={{
              fontSize: '8rem',
              opacity: 0.3,
            }}
          />
          <br />
          <br />
          Select an auth type from above
        </p>
      </div>
    );
  }

  return (
    <>
      <Toolbar className="flex h-(--line-height-sm) w-full shrink-0 items-center border-b border-solid border-(--hl-md) px-2">
        <AuthDropdown
          authentication={authentication}
          authTypes={authTypes}
          hideOthers={hideOthers}
          hideInherit={hideInherit}
          disabled={disabled}
        />
      </Toolbar>
      <div className="flex-1 overflow-y-auto">{authBody}</div>
    </>
  );
};
