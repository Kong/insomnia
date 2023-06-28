import * as electron from 'electron';
import React, { FC, ReactNode, useEffect, useState } from 'react';

interface Props {
  children: ReactNode;
  className?: string | null;
}

export const CheckForUpdatesButton: FC<Props> = ({ children, className }) => {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const statusUnsubscribe = window.main.on('updater.check.status', (_e: Electron.IpcRendererEvent, status: string) => {
      if (checking) {
        setStatus(status);
      }
    });
    const completeUnsubscribe = window.main.on('updater.check.complete', (_e: Electron.IpcRendererEvent, status: string) => {
      setStatus(status);
    });
    return () => {
      statusUnsubscribe();
      completeUnsubscribe();
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
