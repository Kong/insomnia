import React from 'react';
import { Outlet } from 'react-router-dom';

import { InsomniaLogo } from '../components/insomnia-icon';

const Auth = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        background: 'var(--color-bg)',
        paddingTop: '100px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--padding-sm)',
          padding: 'var(--padding-lg)',
          paddingTop: 32,
          maxWidth: '360px',
          background: 'var(--hl-sm)',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
          margin: 0,
        }}
      >
        <InsomniaLogo
          width={64}
          height={64}
          style={{
            transform: 'translate(-50%, -50%)',
            position: 'absolute',
            top: 0,
            left: '50%',
          }}
        />
        <Outlet />
      </div>
    </div>
  );
};

export default Auth;
