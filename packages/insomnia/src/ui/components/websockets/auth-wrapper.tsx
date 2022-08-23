import React, { FC, ReactNode } from 'react';

import { isWebSocketRequest, WebSocketRequest } from '../../../models/websocket-request';
import { AsapAuth } from '../editors/auth/asap-auth';
import { AWSAuth } from '../editors/auth/aws-auth';
import { BasicAuth } from '../editors/auth/basic-auth';
import { BearerAuth } from '../editors/auth/bearer-auth';
import { DigestAuth } from '../editors/auth/digest-auth';
import { HawkAuth } from '../editors/auth/hawk-auth';
import { NetrcAuth } from '../editors/auth/netrc-auth';
import { NTLMAuth } from '../editors/auth/ntlm-auth';
import { OAuth1Auth } from '../editors/auth/o-auth-1-auth';
import { OAuth2Auth } from '../editors/auth/o-auth-2-auth';

interface Props {
  request: WebSocketRequest;
}
export const AuthWrapper: FC<Props> = ({ request }) => {
  if (!request || !isWebSocketRequest(request)) {
    return null;
  }

  let authBody: ReactNode = null;
  if (!request.authentication?.type) {
    authBody = (
      <div className="vertically-center text-center">
        <p className="pad super-faint text-sm text-center">
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
    return <div className='tall'>{authBody}</div>;
  }

  const { authentication: { type } } = request;
  if (type === 'basic') {
    authBody = <BasicAuth />;
  } else if (type === 'oauth2') {
    authBody = <OAuth2Auth requestId={request._id} />;
  } else if (type === 'hawk') {
    authBody = <HawkAuth />;
  } else if (type === 'oauth1') {
    authBody = <OAuth1Auth />;
  } else if (type === 'digest') {
    authBody = <DigestAuth />;
  } else if (type === 'ntlm') {
    authBody = <NTLMAuth />;
  } else if (type === 'bearer') {
    authBody = <BearerAuth />;
  } else if (type === 'iam') {
    authBody = <AWSAuth />;
  } else if (type === 'netrc') {
    authBody = <NetrcAuth />;
  } else if (type === 'asap') {
    authBody = <AsapAuth />;
  } else {
    authBody = (
      <div className="vertically-center text-center">
        <p className="pad super-faint text-sm text-center">
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

  return <div className='tall'>{authBody}</div>;
};
