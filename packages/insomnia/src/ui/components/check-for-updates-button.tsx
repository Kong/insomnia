import React, { useEffect, useState } from 'react';

import type { UpdateStatus } from '../../main/updates';
import { Icon } from './icon';

type UpdateStatusIcon = 'refresh' | 'check' | null;

export const CheckForUpdatesButton = () => {
  const [disabled, setDisabled] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('Check Now');

  useEffect(() => {
    const unsubscribe = window.main.on('updaterStatus',
      (_e: Electron.IpcRendererEvent, status: UpdateStatus) => {
        setStatus(status);
    });
    return () => {
      unsubscribe();
    };
  });

  let statusIcon: UpdateStatusIcon = null;
  if (['Performing backup...', 'Downloading...', 'Checking'].includes(status)) {
    statusIcon = 'refresh';
  }
  if (['Up to Date', 'Updated (Restart Required)'].includes(status)) {
    statusIcon = 'check';
  }

  return (
    <button
      className="flex items-center gap-2 btn btn--outlined btn--super-compact"
      disabled={disabled}
      onClick={() => {
        window.main.manualUpdateCheck();
        // this is to prevent initiating update multiple times
        // if it errors user can restart the app and try again
        setDisabled(true);
      }}
    >
      {statusIcon && <Icon className={statusIcon === 'refresh' ? 'animate-spin' : ''} icon={statusIcon} />}
      {status}
    </button>
  );
};
