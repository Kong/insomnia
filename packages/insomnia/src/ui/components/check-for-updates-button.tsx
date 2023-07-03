import React, { FC, ReactNode, useEffect, useState } from 'react';

interface Props {
  children: ReactNode;
  className?: string | null;
}

export const CheckForUpdatesButton: FC<Props> = ({ children, className }) => {
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
      className={className ?? ''}
      disabled={disabled}
      onClick={() => {
        window.main.manualUpdateCheck();
        // this is to prevent initiating update multiple times
        // if it errors user can restart the app and try again
        setDisabled(true);
      }}
    >
      {status || children}
    </button>
  );
};
