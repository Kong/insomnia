import { useEffect } from 'react';

import { useSettings } from '~/ui/hooks/data/use-settings';
import * as themes from '~/ui/plugins/misc';

export const useThemeChange = () => {
  const settings = useSettings();
  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      console.log(`Applying theme:`);
      themes.applyColorScheme(settings);
    };
    matches.addEventListener('change', applyTheme);
    return () => {
      matches.removeEventListener('change', applyTheme);
    };
  });
};
