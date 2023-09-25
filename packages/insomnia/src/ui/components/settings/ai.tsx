import React, { Fragment } from 'react';

import { useAIContext } from '../../context/app/ai-context';
import { Link } from '../base/link';
import { InsomniaAI } from '../insomnia-ai-icon';

export const AI = () => {

  const {
    access: {
      enabled,
      loading,
    },
  } = useAIContext();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (enabled) {
    return <Fragment>
      <div
        className="notice pad success"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <h1
          className="no-margin-top"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--padding-xs)',
          }}
        >Insomnia AI is enabled
          <InsomniaAI /> </h1>
        <p
          style={{
            textAlign: 'center',
            width: '100%',
            maxWidth: '66ch',
          }}
        >
          The Insomnia AI add-on is currently available on your account. The pay as-you-go consumption of this capability will be automatically added to your account and invoiced accordingly.
        </p>
        <br />
        <div
          className="pad"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--padding-xs)',
          }}
        >
          <i className='fa fa-info-circle' /> Beware that too many requests of Insomnia AI could generate an unpredictable spend.
        </div>
      </div>
    </Fragment >;
  }

  return (
    <Fragment>
      <div
        className="notice pad surprise flex flex-col items-center gap-2"
      >
        <h1 className="mt-0 flex items-center gap-2 text-xl">Try Insomnia AI <InsomniaAI /></h1>
        <p>
          Improve your productivity with Insomnia AI and perform complex operations in 1-click, like auto-generating API tests for your documents and collections.
          <br />
          <br />
          This capability is an add-on to Enterprise customers only.
        </p>
        <br />
        <div className="pad">
          <Link button className="btn btn--clicky" href="https://insomnia.rest/pricing/contact">
            Enable Insomnia AI <i className="fa fa-external-link" />
          </Link>
        </div>
      </div>
    </Fragment >
  );
};
