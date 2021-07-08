import { useCallback, useEffect, useState } from 'react';
import * as models from '../../models';
import { Settings } from '../../models/settings';
import { getThemes } from '../../plugins';
import { applyColorScheme, PluginTheme, ThemeSettings } from '../../plugins/misc';

export const useThemePlugins = (settings: Settings) => {
  const [themes, setThemes] = useState<PluginTheme[]>([]);
  const {
    autoDetectColorScheme,
    lightTheme: activeLightTheme,
    darkTheme: activeDarkTheme,
    theme: activeTheme,
  } = settings;

  useEffect(() => {
    const func = async () => {
      const pluginThemes = await getThemes();
      setThemes(pluginThemes.map(({ theme }) => theme));
    };
    func();
  }, [settings.pluginConfig]);

  const isThemeActive = useCallback((theme: PluginTheme) => {
    if (autoDetectColorScheme) {
      return theme.name === activeLightTheme || theme.name === activeDarkTheme;
    }
    return theme.name === activeTheme;
  }, [activeLightTheme, activeDarkTheme, activeTheme, autoDetectColorScheme]);

  const patchTheme = useCallback(async (themeSettings: Partial<ThemeSettings>) => {
    await applyColorScheme({
      autoDetectColorScheme,
      lightTheme: activeLightTheme,
      darkTheme: activeDarkTheme,
      theme: activeTheme,
      ...themeSettings,
    });
    await models.settings.patch(themeSettings);
  }, [activeLightTheme, activeDarkTheme, activeTheme, autoDetectColorScheme]);

  return {
    themes,
    isThemeActive,
    patchTheme,
  };
};
