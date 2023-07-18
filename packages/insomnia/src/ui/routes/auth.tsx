import React from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

const _Auth = () => {
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

const Background = styled('div')({
  position: 'relative',
  height: '100%',
  width: '100%',
  textAlign: 'center',
  display: 'flex',
  background: 'linear-gradient(0deg, #35007F 0%, #4000BF 50%, #35007F 60.81%, #000000 93.75%)',
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
