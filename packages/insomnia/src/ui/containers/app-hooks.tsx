import { type FC, useEffect } from 'react';

import { useCio } from '../hooks/use-cio';
import { useGlobalKeyboardShortcuts } from '../hooks/use-global-keyboard-shortcuts';
import { useSettingsSideEffects } from '../hooks/use-settings-side-effects';
import { useThemeChange } from '../hooks/use-theme-change';

export const AppHooks: FC = () => {
  useSettingsSideEffects();
  useGlobalKeyboardShortcuts();
  useThemeChange();
  useCio();
  // Used for detecting if we just updated Insomnia and app --args or insomnia:// and
  useEffect(() => {
    setTimeout(() => window.main.halfSecondAfterAppStart(), 500);
  }, []);

  return null;
};
