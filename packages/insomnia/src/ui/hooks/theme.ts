import type { ThemeSettings } from 'insomnia-data';
import { useCallback, useEffect, useState } from 'react';
import * as reactUse from 'react-use';

import type { PluginTheme } from '~/common/plugins/bridge-types';
import { type ColorScheme } from '~/common/plugins/types';
import { useRootLoaderData } from '~/root';
import { AnalyticsEvent } from '~/ui/analytics';
import { applyColorScheme, getColorScheme } from '~/ui/plugins/misc';
import { plugins } from '~/ui/plugins/renderer-bridge';

import { useSettingsPatcher } from './use-request';

export const useThemes = () => {
  const { settings } = useRootLoaderData()!;
  const { lightTheme, darkTheme, autoDetectColorScheme, theme, pluginConfig } = settings;

  const [themes, setThemes] = useState<PluginTheme[]>([]);

  reactUse.useAsync(async () => {
    const pluginThemes = await plugins.getThemes();
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
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.themeChanged,
        properties: { themeName, colorScheme },
      });

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

  let lightTheme = 'default';
  let darkTheme = 'default';
  let theme = 'default';
  let autoDetectColorScheme = false;
  if (rootLoaderData?.settings) {
    lightTheme = rootLoaderData.settings.lightTheme;
    darkTheme = rootLoaderData.settings.darkTheme;
    theme = rootLoaderData.settings.theme;
    autoDetectColorScheme = rootLoaderData.settings.autoDetectColorScheme;
  }

  const calcIsLightTheme = useCallback(() => {
    let isLightTheme = false;
    const colorScheme = getColorScheme({
      autoDetectColorScheme,
      darkTheme,
      lightTheme,
      theme,
    });
    if (colorScheme === 'light') {
      isLightTheme = lightTheme.includes('light');
    } else if (colorScheme === 'dark') {
      isLightTheme = darkTheme.includes('light');
    } else {
      // check if user has selected a light theme
      isLightTheme = theme.includes('light');
    }
    return isLightTheme;
  }, [lightTheme, darkTheme, theme, autoDetectColorScheme]);

  const [isLightTheme, setIsLightTheme] = useState<boolean>(calcIsLightTheme);

  // Listen to system theme changes
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      setIsLightTheme(calcIsLightTheme());
    };
    matches.addEventListener('change', onChange);
    return () => {
      matches.removeEventListener('change', onChange);
    };
  }, [calcIsLightTheme]);

  // Listen to settings changes
  useEffect(() => {
    setIsLightTheme(calcIsLightTheme());
  }, [calcIsLightTheme, lightTheme, darkTheme, theme, autoDetectColorScheme]);
  return isLightTheme;
};
