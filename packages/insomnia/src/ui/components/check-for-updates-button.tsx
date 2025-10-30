import React, { useState } from 'react';

import { Icon } from './icon';

export const CheckForUpdatesButton = () => {
  const [disabled, setDisabled] = useState(false);

  return (
    <button
      className="btn btn--outlined btn--super-compact flex items-center gap-2"
      disabled={disabled}
      onClick={() => {
        window.main.manualUpdateCheck();
        setDisabled(true);
        setTimeout(() => setDisabled(false), 3000); // re-enable after 3 seconds
      }}
    >
      {<Icon className={disabled ? 'animate-spin' : ''} icon={disabled ? 'refresh' : 'check'} />}
      Check
    </button>
  );
};
