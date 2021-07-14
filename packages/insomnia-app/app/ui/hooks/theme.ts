import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { unreachableCase } from 'ts-assert-unreachable';
import * as models from '../../models';
import { ThemeSettings } from '../../models/settings';
import { ColorScheme, getThemes } from '../../plugins';
import { applyColorScheme, PluginTheme } from '../../plugins/misc';
import { selectSettings } from '../redux/selectors';

export const useThemes = () => {
  const {
    lightTheme,
    darkTheme,
    autoDetectColorScheme,
    theme,
    pluginConfig,
  } = useSelector(selectSettings);

  const [themes, setThemes] = useState<PluginTheme[]>([]);

  // Reload themes if pluginConfig changes
  useEffect(() => {
    const func = async () => {
      const pluginThemes = await getThemes();
      setThemes(pluginThemes.map(({ theme }) => theme));
    };
    func();
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

  // Apply the theme and update settings
  const apply = useCallback(async (patch: Partial<ThemeSettings>) => {
    applyColorScheme({
      theme,
      autoDetectColorScheme,
      darkTheme,
      lightTheme,
      ...patch,
    });
    await models.settings.patch(patch);
  }, [autoDetectColorScheme, darkTheme, lightTheme, theme]);

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
        unreachableCase(colorScheme);
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
