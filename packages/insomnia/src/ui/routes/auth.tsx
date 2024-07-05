import React, { useEffect, useState } from 'react';
import { Button, Link, Tooltip, TooltipTrigger } from 'react-aria-components';
import { Outlet } from 'react-router-dom';

import { Hotkey } from '../components/hotkey';
import { Icon } from '../components/icon';
import { InsomniaLogo } from '../components/insomnia-icon';
import { showSettingsModal } from '../components/modals/settings-modal';
import { TrailLinesContainer } from '../components/trail-lines-container';
import { useRootLoaderData } from './root';

const Auth = () => {
  const { userSession, settings } = useRootLoaderData();
  const [status, setStatus] = useState<'online' | 'offline'>('online');
  useEffect(() => {
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className='grid [grid-template-rows:1fr_30px] w-full h-full'>
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
      <div className="relative flex items-center overflow-hidden">
        <div className='flex w-full h-full items-center justify-between'>
          <div className="flex h-full">
            <TooltipTrigger>
              <Button
                data-testid="settings-button"
                className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                onPress={() => showSettingsModal()}
              >
                <Icon icon="gear" /> Preferences
              </Button>
              <Tooltip
                placement="top"
                offset={8}
                className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                Preferences
                <Hotkey
                  keyBindings={
                    settings.hotKeyRegistry.preferences_showGeneral
                  }
                />
              </Tooltip>
            </TooltipTrigger>

          </div>
          <div className='flex items-center gap-2 divide divide-y-[--hl-sm]'>

            <TooltipTrigger>
              <Button
                className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                onPress={() => {
                  if (settings.proxyEnabled) {
                    showSettingsModal({
                      tab: 'proxy',
                    });
                  }
                }}
              >
                <Icon
                  icon="circle"
                  className={
                    userSession
                      ? status === 'online'
                        ? 'text-[--color-success]'
                        : 'text-[--color-danger]'
                      : ''
                  }
                />{' '}
                {userSession
                  ? status.charAt(0).toUpperCase() + status.slice(1)
                  : 'Log in to see your projects'}
                {settings.proxyEnabled ? ' via proxy' : ''}
              </Button>
              <Tooltip
                placement="top"
                offset={8}
                className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                {userSession
                  ? status === 'online' ? 'You have connectivity to the Internet' + (settings.proxyEnabled ? ' via the configured proxy' : '') + '.'
                    : 'You are offline. Connect to sync your data.'
                  : 'Login to Insomnia to unlock the full product experience.'}
              </Tooltip>
            </TooltipTrigger>
            <span className='w-[1px] h-full bg-[--hl-sm]' />
            <Link>
              <a
                className="flex focus:outline-none focus:underline gap-1 items-center text-xs text-[--color-font] px-[--padding-md]"
                href="https://konghq.com/"
              >
                Made with
                <Icon className="text-[--color-surprise-font]" icon="heart" /> by
                Kong
              </a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
