import { useEffect, useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';

import { setMenuBarVisibility } from '../../common/electron-helpers';
import { selectSettings } from '../redux/selectors';

const updateFontStyle = (key: string, value: string | null) => document?.querySelector('html')?.style.setProperty(key, value);

export const useSettingsSideEffects = () => {
  const settings = useSelector(selectSettings);

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
    setMenuBarVisibility(!settings.autoHideMenuBar);
  }, [settings.autoHideMenuBar]);
};
