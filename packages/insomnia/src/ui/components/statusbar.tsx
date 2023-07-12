import React, { FC, useEffect, useState } from 'react';
import styled from 'styled-components';

import { isLoggedIn, onLoginLogout } from '../../account/session';
import { SettingsButton } from './buttons/settings-button';
import { SvgIcon } from './svg-icon';
import { Tooltip } from './tooltip';

const Bar = styled.div({
  position: 'relative',
  gridArea: 'Statusbar',
  borderTop: '1px solid var(--hl-md)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  overflow: 'hidden',
});

const KongLink = styled.a({
  '&&': {
    display: 'flex',
    alignItems: 'center',
    fontSize: 'var(--font-size-xs)',
    padding: '0 var(--padding-md)',
    justifyContent: 'flex-end',
    boxSizing: 'border-box',
    color: 'var(--color-font)',
  },
});

export const NetworkStatus = () => {
  const [status, setStatus] = useState<'online' | 'offline' | 'unauthorized'>(isLoggedIn() ? 'online' : 'unauthorized');

  useEffect(() => {
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    onLoginLogout(isLoggedIn => {
      setStatus(status => isLoggedIn ? status : 'unauthorized');
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <Tooltip
      delay={1000}
      position="bottom"
      message={
        <>
          You are {status === 'online' ? 'securely connected to Insomnia Cloud' : 'offline. Connect to sync your data.'}
        </>
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--padding-xs)',
        }}
      >
        <span
          style={{
            backgroundColor: {
              online: 'var(--color-success)',
              offline: 'var(--color-danger)',
              unauthorized: 'var(--color-warning)',
            }[status],
            width: '8px',
            height: '8px',
            borderRadius: '100%',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            color: 'var(--color-font)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          {status === 'unauthorized' && 'Log in to sync your data'}
          {status !== 'unauthorized' && status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    </Tooltip>
  );
};

export const StatusBar: FC = () => {
  return (
    <Bar>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--padding-md)',
        }}
      >
        <SettingsButton />
        <NetworkStatus />
      </div>
      <KongLink className="made-with-love" href="https://konghq.com/">
        Made with&nbsp; <SvgIcon icon="heart" /> &nbsp;by Kong
      </KongLink>
    </Bar>
  );
};
