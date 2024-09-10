import React, { useEffect, useState } from 'react';

import { UpdateStatuses, UpdateStatusText } from '../../common/constants';
import { Icon } from './icon';

export const CheckForUpdatesButton = () => {
  const [disabled, setDisabled] = useState(false);
  const [status, setStatus] = useState<keyof typeof UpdateStatuses>(UpdateStatuses.DEFAULT);
  const { statusIcon, label } = useUpdateStatus(status);

  useEffect(() => {
    const unsubscribe = window.main.on('updaterStatus',
      (_e: Electron.IpcRendererEvent, status: typeof UpdateStatuses[keyof typeof UpdateStatuses]) => {
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
      {label}
    </button>
  );
};

interface UseUpdateStatus {
  statusIcon: 'refresh' | 'check' | null;
  label: string;
}
function useUpdateStatus(status: keyof typeof UpdateStatuses): UseUpdateStatus {
  const label = UpdateStatusText[status];
  if ([UpdateStatuses.BACKUP_IN_PROGRESS, UpdateStatuses.DOWNLOADING, UpdateStatuses.CHECKING].includes(status)) {
    return {
      statusIcon: 'refresh',
      label,
    };
  }

  if ([UpdateStatuses.UP_TO_DATE, UpdateStatuses.UPDATED].includes(status)) {
    return {
      statusIcon: 'check',
      label,
    };
  }

  return {
    statusIcon: null,
    label,
  };
}
