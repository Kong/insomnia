import { useEffect } from 'react';

import * as themes from '../../plugins/misc';
import { useRootLoaderData } from '../routes/root';

export const useThemeChange = () => {
  const { settings } = useRootLoaderData();
  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => themes.applyColorScheme(settings);
    matches.addEventListener('change', applyTheme);
    return () => {
      matches.removeEventListener('change', applyTheme);
    };
  });
};
