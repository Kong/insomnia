import { useEffect, useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import { usePrevious } from 'react-use';

import { restartApp, setMenuBarVisibility } from '../../common/electron-helpers';
import { Settings } from '../../models/settings';
import { selectSettings } from '../redux/selectors';

const useNunjucksRestart = (settings: Settings) => {
  const previousNunjucksPowerUserMode = usePrevious(settings.nunjucksPowerUserMode);
  useEffect(() => {
    // for the first value only, the return of `usePrevious` is `undefined` since there's no "previous" value at the time of the first value.
    if (previousNunjucksPowerUserMode === undefined) {
      return;
    }

    // there's not been a change, so no need to take any action
    if (settings.nunjucksPowerUserMode === previousNunjucksPowerUserMode) {
      return;
    }

    restartApp();
  }, [settings.nunjucksPowerUserMode, previousNunjucksPowerUserMode]);
};

const updateFontStyle = (key: string, value: string | null) => document?.querySelector('html')?.style.setProperty(key, value);

// as a general rule, if the body effect in this file is more than one line, extract into a separate function.
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

  useNunjucksRestart(settings);
};
