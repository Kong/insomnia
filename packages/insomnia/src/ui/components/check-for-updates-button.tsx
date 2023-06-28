import React, { FC, ReactNode, useEffect, useState } from 'react';

interface Props {
  children: ReactNode;
  className?: string | null;
}

export const CheckForUpdatesButton: FC<Props> = ({ children, className }) => {
  const [checking, setChecking] = useState(false);
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
      disabled={checking}
      onClick={() => {
        window.main.manualUpdateCheck();
        setChecking(true);
      }}
    >
      {status || children}
    </button>
  );
};
