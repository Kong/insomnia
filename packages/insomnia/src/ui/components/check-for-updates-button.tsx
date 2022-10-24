import * as electron from 'electron';
import React, { FC, ReactNode, useEffect, useState } from 'react';

interface Props {
  children: ReactNode;
  className?: string | null;
}

export const CheckForUpdatesButton: FC<Props> = ({ children, className }) => {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');
  const [, setUpdateAvailable] = useState(false);

  const listenerCheckComplete = (_e: Electron.IpcRendererEvent, updateAvailable: true, status: string) => {
    setStatus(status);
    setUpdateAvailable(updateAvailable);
  };

  const listenerCheckStatus = (_e: Electron.IpcRendererEvent, status: string) => {
    if (checking) {
      setStatus(status);
    }
  };
  useEffect(() => {
    electron.ipcRenderer.on('updater.check.status', listenerCheckStatus);
    electron.ipcRenderer.on('updater.check.complete', listenerCheckComplete);
    return () => {
      electron.ipcRenderer.removeListener('updater.check.complete', listenerCheckComplete);
      electron.ipcRenderer.removeListener('updater.check.status', listenerCheckStatus);
    };
  });
  return (
    <button
      className={className ?? ''}
      disabled={checking}
      onClick={() => {
        electron.ipcRenderer.send('updater.check');
        setChecking(true);
      }}
    >
      {status || children}
    </button>
  );
};
