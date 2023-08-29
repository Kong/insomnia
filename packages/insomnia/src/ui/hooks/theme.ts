import { ChangeEvent, useCallback, useState } from 'react';
import { useAsync } from 'react-use';

import { ThemeSettings } from '../../models/settings';
import { ColorScheme, getThemes } from '../../plugins';
import { applyColorScheme, PluginTheme } from '../../plugins/misc';
import { useRootLoaderData } from '../routes/root';
import { useSettingsPatcher } from './use-request';

export const useThemes = () => {
  const {
    settings,
  } = useRootLoaderData();
  const {
    lightTheme,
    darkTheme,
    autoDetectColorScheme,
    theme,
    pluginConfig,
  } = settings;

  const [themes, setThemes] = useState<PluginTheme[]>([]);

  useAsync(async () => {
    const pluginThemes = await getThemes();
    setThemes(pluginThemes.map(({ theme }) => theme));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Reload themes if pluginConfig changes
  }, [pluginConfig]);

  // Check if the theme is active
  const isActiveDark = useCallback(({ name }: PluginTheme) => name === darkTheme, [darkTheme]);
  const isActiveLight = useCallback(({ name }: PluginTheme) => name === lightTheme, [lightTheme]);

  const isActive = useCallback((pluginTheme : PluginTheme) => {
    if (autoDetectColorScheme) {
      return isActiveLight(pluginTheme) || isActiveDark(pluginTheme);
    }
    return pluginTheme.name === theme;
  }, [autoDetectColorScheme, isActiveDark, isActiveLight, theme]);
  const patchSettings = useSettingsPatcher();

  // Apply the theme and update settings
  const apply = useCallback(async (patch: Partial<ThemeSettings>) => {
    applyColorScheme({
      theme,
      autoDetectColorScheme,
      darkTheme,
      lightTheme,
      ...patch,
    });
    patchSettings(patch);

  }, [autoDetectColorScheme, darkTheme, lightTheme, patchSettings, theme]);

  const changeAutoDetect = useCallback(({ target: { checked } }: ChangeEvent<HTMLInputElement>) => apply({ autoDetectColorScheme: checked }), [apply]);

  // Activate the theme for the selected color scheme
  const activate = useCallback(async (themeName: string, colorScheme: ColorScheme) => {
    switch (colorScheme) {
      case 'light':
        await apply({ lightTheme: themeName });
        break;

      case 'dark':
        await apply({ darkTheme: themeName });
        break;

      case 'default':
        await apply({ theme: themeName });
        break;

      default:
        throw new Error(colorScheme);
    }
  }, [apply]);

  return {
    themes,
    isActive,
    isActiveLight,
    isActiveDark,
    activate,
    changeAutoDetect,
    autoDetectColorScheme,
  };
};
