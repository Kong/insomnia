import { useCallback, useMemo, useState } from 'react';
import * as reactUse from 'react-use';

import { useRootLoaderData } from '~/root';

import type { ThemeSettings } from '../../models/settings';
import { type ColorScheme, getThemes } from '../../plugins';
import { applyColorScheme, getColorScheme, type PluginTheme } from '../../plugins/misc';
import { useSettingsPatcher } from './use-request';

export const useThemes = () => {
  const { settings } = useRootLoaderData()!;
  const { lightTheme, darkTheme, autoDetectColorScheme, theme, pluginConfig } = settings;

  const [themes, setThemes] = useState<PluginTheme[]>([]);

  reactUse.useAsync(async () => {
    const pluginThemes = await getThemes();
    setThemes(pluginThemes.map(({ theme }) => theme));
  }, [pluginConfig]);

  // Check if the theme is active
  const isActiveDark = useCallback(({ name }: PluginTheme) => name === darkTheme, [darkTheme]);
  const isActiveLight = useCallback(({ name }: PluginTheme) => name === lightTheme, [lightTheme]);

  const isActive = useCallback(
    (pluginTheme: PluginTheme) => {
      if (autoDetectColorScheme) {
        return isActiveLight(pluginTheme) || isActiveDark(pluginTheme);
      }
      return pluginTheme.name === theme;
    },
    [autoDetectColorScheme, isActiveDark, isActiveLight, theme],
  );
  const patchSettings = useSettingsPatcher();

  // Apply the theme and update settings
  const apply = useCallback(
    async (patch: Partial<ThemeSettings>) => {
      applyColorScheme({
        theme,
        autoDetectColorScheme,
        darkTheme,
        lightTheme,
        ...patch,
      });
      patchSettings(patch);
    },
    [autoDetectColorScheme, darkTheme, lightTheme, patchSettings, theme],
  );

  const changeAutoDetect = useCallback((autoDetectColorScheme: boolean) => apply({ autoDetectColorScheme }), [apply]);

  // Activate the theme for the selected color scheme
  const activate = useCallback(
    async (themeName: string, colorScheme: ColorScheme) => {
      switch (colorScheme) {
        case 'light': {
          await apply({ lightTheme: themeName });
          break;
        }

        case 'dark': {
          await apply({ darkTheme: themeName });
          break;
        }

        case 'default': {
          await apply({ theme: themeName });
          break;
        }

        default: {
          throw new Error(colorScheme);
        }
      }
    },
    [apply],
  );

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

export const useIsLightTheme = () => {
  const rootLoaderData = useRootLoaderData();
  const isLightTheme = useMemo(() => {
    let isLightTheme = false;
    if (rootLoaderData?.settings) {
      const colorScheme = getColorScheme(rootLoaderData.settings);
      if (colorScheme === 'light') {
        isLightTheme = true;
      } else if (colorScheme === 'dark') {
        isLightTheme = false;
      } else {
        // check if user has selected a light theme
        isLightTheme = rootLoaderData.settings.theme.includes('light');
      }
    }
    return isLightTheme;
  }, [rootLoaderData?.settings]);
  return isLightTheme;
};
