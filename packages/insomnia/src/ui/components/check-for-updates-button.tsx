import React, { useEffect, useState } from 'react';

import { UpdateStatus, UpdateStatuses } from '../../common/constants';
import { Icon } from './icon';

export const CheckForUpdatesButton = () => {
  const [disabled, setDisabled] = useState(false);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const { statusIcon, label } = useUpdateStatus(status);

  useEffect(() => {
    const unsubscribe = window.main.on('updaterStatus',
      (_e: Electron.IpcRendererEvent, status: UpdateStatus) => setStatus(status));
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
function useUpdateStatus(status: UpdateStatus | null): UseUpdateStatus {
  if (!status) {
    return {
      statusIcon: null,
      label: 'Check now',
    };
  }

  if (['BACKUP_IN_PROGRESS', 'DOWNLOADING', 'CHECKING'].includes(status)) {
    return {
      statusIcon: 'refresh',
      label: UpdateStatuses[status],
    };
  }

  return {
    statusIcon: 'check',
    label: UpdateStatuses[status],
  };
}
