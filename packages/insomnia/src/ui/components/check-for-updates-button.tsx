import React, { useEffect, useRef, useState } from 'react';

import { type UpdateStatus } from '../../common/constants';
import { Icon } from './icon';

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

  const isBusy = status === 'checking' || status === 'downloading';
  const isReadyToRestart = status === 'readyToRestart';

  return (
    <button
      className="btn btn--outlined btn--super-compact flex items-center gap-2"
      disabled={isBusy}
      onClick={() => {
        if (isReadyToRestart) {
          window.main.applyUpdateAndRestart();
          return;
        }
        window.main.manualUpdateCheck();
        setStatus('checking');
      }}
    >
      <Icon className={isBusy ? 'animate-spin' : ''} icon={isReadyToRestart ? 'rotate' : isBusy ? 'refresh' : 'check'} />
      {STATUS_LABELS[status]}
    </button>
  );
};
