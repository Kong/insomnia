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

  switch (type) {
  case 'basic': {
    authBody = <BasicAuth disabled={disabled} />;
  
  break;
  }
  case 'apikey': {
    authBody = <ApiKeyAuth disabled={disabled} addToHeaderOnly={addToHeaderOnly} />;
  
  break;
  }
  case 'oauth2': {
    authBody = <OAuth2Auth showMcpAuthFlow={showMcpAuthFlow} disabled={disabled} />;
  
  break;
  }
  case 'hawk': {
    authBody = <HawkAuth />;
  
  break;
  }
  case 'oauth1': {
    authBody = <OAuth1Auth />;
  
  break;
  }
  case 'digest': {
    authBody = <DigestAuth disabled={disabled} />;
  
  break;
  }
  case 'ntlm': {
    authBody = <NTLMAuth />;
  
  break;
  }
  case 'bearer': {
    authBody = <BearerAuth disabled={disabled} />;
  
  break;
  }
  case 'iam': {
    authBody = <AWSAuth />;
  
  break;
  }
  case 'netrc': {
    authBody = <NetrcAuth />;
  
  break;
  }
  case 'asap': {
    authBody = <AsapAuth />;
  
  break;
  }
  case 'singleToken': {
    authBody = <SingleTokenAuth disabled={disabled} />;
  
  break;
  }
  default: {
    authBody = (
      <div className="flex h-full w-full select-none items-center justify-center">
        <p className="p-4 text-center text-sm text-[--hl]">
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
  }

  return (
    <>
      <Toolbar className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center border-b border-solid border-[--hl-md] px-2">
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
