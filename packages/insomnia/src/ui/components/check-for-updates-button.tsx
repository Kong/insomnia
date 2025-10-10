import React, { useState } from 'react';

import { Icon } from './icon';

type UpdateStatusIcon = 'refresh' | 'check' | null;

export const CheckForUpdatesButton = () => {
  const [disabled, setDisabled] = useState(false);

  let statusIcon: UpdateStatusIcon = null;
  if (['Performing backup...', 'Downloading...', 'Checking'].includes(status)) {
    statusIcon = 'refresh';
  }
  if (['Up to Date', 'Updated (Restart Required)'].includes(status)) {
    statusIcon = 'check';
  }

  return (
    <button
      className="btn btn--outlined btn--super-compact flex items-center gap-2"
      disabled={disabled}
      onClick={() => {
        window.main.manualUpdateCheck();
        // this is to prevent initiating update multiple times
        // if it errors user can restart the app and try again
        setDisabled(true);
      }}
    >
      {statusIcon && <Icon className={statusIcon === 'refresh' ? 'animate-spin' : ''} icon={statusIcon} />}
      Check
    </button>
  );
};
