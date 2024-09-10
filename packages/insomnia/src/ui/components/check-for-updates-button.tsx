import React, { useEffect, useState } from 'react';

import { type UpdateStatus } from '../../common/constants';
import { Icon } from './icon';

export const CheckForUpdatesButton = () => {
  const [disabled, setDisabled] = useState(false);
  const [status, setStatus] = useState<UpdateStatus>('Check Now');
  const statusIcon = useUpdateStatusIcon(status);

  useEffect(() => {
    const unsubscribe = window.main.on('updaterStatus',
      (_e: Electron.IpcRendererEvent, status: UpdateStatus) => {
        setStatus(status);
    });
    return () => {
      unsubscribe();
    };
  });

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

type UpdateStatusIcon = 'refresh' | 'check' | null;
function useUpdateStatusIcon(status: UpdateStatus): UpdateStatusIcon {
  if (['Performing backup...', 'Downloading...', 'Checking'].includes(status)) {
    return 'refresh';
  }

  if (['Up to Date', 'Updated (Restart Required)'].includes(status)) {
    return 'check';
  }

  return null;
}
