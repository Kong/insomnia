import React, { useEffect, useState } from 'react';

import { Icon } from './icon';

export const CheckForUpdatesButton = () => {
  const [disabled, setDisabled] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const unsubscribe = window.main.on('updaterStatus',
      (_e: Electron.IpcRendererEvent, status: string) => setStatus(status));
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
      <Icon className={status && 'animate-spin'} icon="refresh" />
      {status || 'Check now'}
    </button>
  );
};
