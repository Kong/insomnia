import React from 'react';
import { Outlet } from 'react-router-dom';

import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

const Auth = () => {
  return (
    <div className='relative h-full w-full text-center flex bg-[--color-bg]'>
      <TrailLinesContainer>
        <div className='flex flex-col justify-center items-center h-full min-h-[450px]'>
          <div className='flex flex-col items-center justify-center gap-[--padding-sm] p-[--padding-lg] pt-[32px] min-w-[400px] max-w-lg rounded-md relative bg-[--hl-sm] m-0'>
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
    </div>
  );
};

export default Auth;
