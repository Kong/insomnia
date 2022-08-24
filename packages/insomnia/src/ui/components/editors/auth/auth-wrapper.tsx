import React, { FC } from 'react';

import { AsapAuth } from './asap-auth';
import { AWSAuth } from './aws-auth';
import { BasicAuth } from './basic-auth';
import { BearerAuth } from './bearer-auth';
import { useAuthSettings } from './components/auth-context';
import { DigestAuth } from './digest-auth';
import { HawkAuth } from './hawk-auth';
import { NetrcAuth } from './netrc-auth';
import { NTLMAuth } from './ntlm-auth';
import { OAuth1Auth } from './o-auth-1-auth';
import { OAuth2Auth } from './o-auth-2-auth';

const AuthBody: FC<{
  requestId: string;
}> = ({ requestId }) => {
  const { authentication } = useAuthSettings();
  switch (authentication?.type) {
    case 'basic': {
      return <BasicAuth />;
    }

    case 'oauth2': {
      return <OAuth2Auth requestId={requestId} />;
    }

    case 'hawk': {
      return <HawkAuth />;
    }

    case 'oauth1': {
      return <OAuth1Auth />;
    }

    case 'digest': {
      return <DigestAuth />;
    }

    case 'ntlm': {
      return <NTLMAuth />;
    }

    case 'bearer': {
      return <BearerAuth />;
    }

    case 'iam': {
      return <AWSAuth />;
    }

    case 'netrc': {
      return <NetrcAuth />;
    }

    case 'asap': {
      return <AsapAuth />;
    }

    default: {
      return (
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
  }
};

export const AuthWrapper: FC<{ requestId: string }> = ({ requestId }) => {
  return (
    <div className='tall'>
      <AuthBody requestId={requestId} />
    </div>
  );
};
