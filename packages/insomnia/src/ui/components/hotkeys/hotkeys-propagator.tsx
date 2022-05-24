import React, { FunctionComponent, ReactNode, useEffect } from 'react';

import { hotKeyRefs } from '../../../common/hotkeys';
import { useHotKey } from './hotkeys-context';

export const HotkeysPropagator: FunctionComponent<{ children: ReactNode }> = ({ children }) => {
  const { sendHotkeyCommand, checkHotkeyPressed } = useHotKey();

  useEffect(() => {
    const body = document.body;
    const listener = async (e: KeyboardEvent) => {
      const result = await checkHotkeyPressed(e, hotKeyRefs);
      if (!result) {
        return;
      }

      sendHotkeyCommand(result.id);
    };

    body.addEventListener('keydown', listener);
    return () => body.removeEventListener('keydown', listener);
  }, [sendHotkeyCommand, checkHotkeyPressed]);

  return <>{children}</>;
};
