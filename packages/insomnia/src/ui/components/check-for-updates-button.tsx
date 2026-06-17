import React, { useEffect, useRef, useState } from 'react';

import { allowUpdatesInDev, isDevelopment, type UpdateStatus } from '../../common/constants';
import { Icon } from './icon';
import { Tooltip } from './tooltip';

const STATUS_LABELS: Record<UpdateStatus, string> = {
  idle: 'Check',
  checking: 'Checking...',
  downloading: 'Downloading...',
  readyToRestart: 'Restart and Update',
};

const CHECKING_FALLBACK_MS = 30_000;

export const CheckForUpdatesButton = () => {
  const [status, setStatus] = useState<UpdateStatus>(() => window.main.getUpdateStatus() || 'idle');
  const fallbackRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const unsubscribe = window.main.on('update-status-changed', (_, nextStatus: UpdateStatus) => {
      setStatus(nextStatus);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    clearTimeout(fallbackRef.current);
    if (status === 'checking') {
      fallbackRef.current = setTimeout(() => setStatus('idle'), CHECKING_FALLBACK_MS);
    }
    return () => clearTimeout(fallbackRef.current);
  }, [status]);

  const updatesDisabledInDev = isDevelopment() && !allowUpdatesInDev();
  const isBusy = status === 'checking' || status === 'downloading';
  const isReadyToRestart = status === 'readyToRestart';

  const button = (
    <button
      className={`btn btn--outlined btn--super-compact flex items-center gap-2${updatesDisabledInDev ? ' pointer-events-none' : ''}`}
      disabled={isBusy || updatesDisabledInDev}
      onClick={() => {
        if (isReadyToRestart) {
          window.main.applyUpdateAndRestart();
          return;
        }
        window.main.manualUpdateCheck();
      }}
    >
      <Icon className={isBusy ? 'animate-spin' : ''} icon={isReadyToRestart ? 'rotate' : isBusy ? 'refresh' : 'check'} />
      {STATUS_LABELS[status]}
    </button>
  );

  if (updatesDisabledInDev) {
    return (
      <Tooltip message="Updates are disabled in development mode" position="top">
        {button}
      </Tooltip>
    );
  }

  return button;
};
