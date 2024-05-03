import { useEffect, useLayoutEffect } from 'react';
import { usePrevious } from 'react-use';

import { Settings } from '../../models/settings';
import { useRootLoaderData } from '../routes/root';

const useRestartSetting = (setting: keyof Settings) => {
  const {
    settings,
  } = useRootLoaderData();

  const nextValue = settings[setting];
  const previousValue = usePrevious(nextValue);
  useEffect(() => {
    // for the first value only, the return of `usePrevious` is `undefined` since there's no "previous" value at the time of the first value.
    if (previousValue === undefined) {
      return;
    }

    // there's not been a change, so no need to take any action
    if (nextValue === previousValue) {
      return;
    }

    window.main.restart();
  }, [nextValue, previousValue]);
};

const updateFontStyle = (key: string, value: string | null) => document?.querySelector('html')?.style.setProperty(key, value);

// as a general rule, if the body effect in this file is more than one line, extract into a separate function.
export const useSettingsSideEffects = () => {
  const {
    settings,
  } = useRootLoaderData();

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

  useRestartSetting('nunjucksPowerUserMode');
  useRestartSetting('showVariableSourceAndValue');
};
