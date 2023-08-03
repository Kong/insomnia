import React from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

const Background = styled('div')({
  position: 'relative',
  height: '100%',
  width: '100%',
  textAlign: 'center',
  display: 'flex',
  background: 'var(--color-bg)',
});

const Auth = () => {
  return (
    <Background>
      <TrailLinesContainer>
        <div
          style={{
            display:'flex',
            justifyContent:'center',
            alignItems:'center',
            flexDirection:'column',
            height:'100%',
            minHeight: 450,
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
              minWidth: '340px',
              maxWidth: '400px',
              borderRadius: 'var(--radius-md)',
              position: 'relative',
              background: 'var(--hl-sm)',
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
      </TrailLinesContainer>
    </Background>
  );
};

export default Auth;
