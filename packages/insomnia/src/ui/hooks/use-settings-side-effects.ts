import { useEffect, useLayoutEffect } from 'react';

import { useSettings } from '~/ui/hooks/data/use-settings';

const updateFontStyle = (key: string, value: string | null) =>
  document?.querySelector('html')?.style.setProperty(key, value);

// as a general rule, if the body effect in this file is more than one line, extract into a separate function.
export const useSettingsSideEffects = () => {
  const settings = useSettings();

  useLayoutEffect(() => {
    updateFontStyle('--font-default', settings.fontInterface);
  }, [settings.fontInterface]);

  useLayoutEffect(() => {
    updateFontStyle('--font-monospace', settings.fontMonospace);
  }, [settings.fontMonospace]);

  useLayoutEffect(() => {
    updateFontStyle('--font-ligatures', settings.fontVariantLigatures ? 'normal' : 'none');
  }, [settings.fontVariantLigatures]);

  useLayoutEffect(() => {
    updateFontStyle('font-size', `${settings.fontSize}px`);
  }, [settings.fontSize]);

  useEffect(() => {
    window.main.setMenuBarVisibility(!settings.autoHideMenuBar);
  }, [settings.autoHideMenuBar]);
};
