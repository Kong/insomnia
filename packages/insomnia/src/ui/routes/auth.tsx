import React, { useEffect, useState } from 'react';
import { Button, Link, Tooltip, TooltipTrigger } from 'react-aria-components';
import { Outlet } from 'react-router';

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
    <div className="grid h-full w-full [grid-template-rows:1fr_30px]">
      <div className="relative flex h-full w-full bg-[--color-bg] text-center">
        <TrailLinesContainer>
          <div className="flex h-full min-h-[450px] flex-col items-center justify-center">
            <div className="relative m-0 flex min-w-[400px] max-w-lg flex-col items-center justify-center gap-[--padding-sm] rounded-md bg-[--hl-sm] p-[--padding-lg] pt-[32px]">
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
        <div className="flex h-full w-full items-center justify-between">
          <div className="flex h-full">
            <TooltipTrigger>
              <Button
                data-testid="settings-button"
                className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                onPress={() => showSettingsModal()}
              >
                <Icon icon="gear" /> Preferences
              </Button>
              <Tooltip
                placement="top"
                offset={8}
                className="flex max-h-[85vh] min-w-max select-none items-center gap-2 overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
              >
                Preferences
                <Hotkey keyBindings={settings.hotKeyRegistry.preferences_showGeneral} />
              </Tooltip>
            </TooltipTrigger>
          </div>
          <div className="divide flex items-center gap-2 divide-y-[--hl-sm]">
            <TooltipTrigger>
              <Button
                className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
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
                    userSession ? (status === 'online' ? 'text-[--color-success]' : 'text-[--color-danger]') : ''
                  }
                />{' '}
                {userSession ? status.charAt(0).toUpperCase() + status.slice(1) : 'Log in to see your projects'}
                {settings.proxyEnabled ? ' via proxy' : ''}
              </Button>
              <Tooltip
                placement="top"
                offset={8}
                className="flex max-h-[85vh] min-w-max select-none items-center gap-2 overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
              >
                {userSession
                  ? status === 'online'
                    ? 'You have connectivity to the Internet' +
                      (settings.proxyEnabled ? ' via the configured proxy' : '') +
                      '.'
                    : 'You are offline. Connect to sync your data.'
                  : 'Login to Insomnia to unlock the full product experience.'}
              </Tooltip>
            </TooltipTrigger>
            <span className="h-full w-[1px] bg-[--hl-sm]" />
            <Link>
              <a
                className="flex items-center gap-1 px-[--padding-md] text-xs text-[--color-font] focus:underline focus:outline-none"
                href="https://konghq.com/"
              >
                Made with
                <Icon className="text-[--color-surprise-font]" icon="heart" /> by Kong
              </a>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
