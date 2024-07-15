import React, { type FC, type ReactNode } from 'react';
import { Toolbar } from 'react-aria-components';

import {
  AUTH_API_KEY,
  AUTH_ASAP,
  AUTH_AWS_IAM,
  AUTH_BASIC,
  AUTH_BEARER,
  AUTH_DIGEST,
  AUTH_HAWK,
  AUTH_NETRC,
  AUTH_NTLM,
  AUTH_OAUTH_1,
  AUTH_OAUTH_2,
} from '../../../../common/constants';
import type { AuthTypes, RequestAuthentication } from '../../../../models/request';
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

export const AuthWrapper: FC<{ authentication?: RequestAuthentication | {}; disabled?: boolean; authTypes?: AuthTypes[] }> = ({ authentication, disabled = false, authTypes }) => {
  const type = getAuthObjectOrNull(authentication)?.type || '';
  let authBody: ReactNode = null;

  if (type === AUTH_BASIC) {
    authBody = <BasicAuth disabled={disabled} />;
  } else if (type === AUTH_API_KEY) {
    authBody = <ApiKeyAuth disabled={disabled} />;
  } else if (type === AUTH_OAUTH_2) {
    authBody = <OAuth2Auth />;
  } else if (type === AUTH_HAWK) {
    authBody = <HawkAuth />;
  } else if (type === AUTH_OAUTH_1) {
    authBody = <OAuth1Auth />;
  } else if (type === AUTH_DIGEST) {
    authBody = <DigestAuth disabled={disabled} />;
  } else if (type === AUTH_NTLM) {
    authBody = <NTLMAuth />;
  } else if (type === AUTH_BEARER) {
    authBody = <BearerAuth disabled={disabled} />;
  } else if (type === AUTH_AWS_IAM) {
    authBody = <AWSAuth />;
  } else if (type === AUTH_NETRC) {
    authBody = <NetrcAuth />;
  } else if (type === AUTH_ASAP) {
    authBody = <AsapAuth />;
  } else {
    authBody = (
      <div className="flex w-full h-full select-none items-center justify-center">
        <p className="text-sm text-center p-4 text-[--hl]">
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

  return <>
    <Toolbar className="w-full flex-shrink-0 h-[--line-height-sm] border-b border-solid border-[--hl-md] flex items-center px-2">
      <AuthDropdown authentication={authentication} authTypes={authTypes} />
    </Toolbar>
    <div className='flex-1 overflow-y-auto '>
    {authBody}
    </div>
  </>;
};
