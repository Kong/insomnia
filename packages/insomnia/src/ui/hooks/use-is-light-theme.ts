import { useCallback, useEffect, useState } from 'react';

import { useSettings } from '~/ui/hooks/data/use-settings';
import { getColorScheme } from '~/ui/plugins/misc';

// Kept out of ./theme so components rendered under the root route (eg. modals) can use it without
// importing ~/root, which would close an import cycle.
export const useIsLightTheme = () => {
  const { lightTheme, darkTheme, theme, autoDetectColorScheme } = useSettings();

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
