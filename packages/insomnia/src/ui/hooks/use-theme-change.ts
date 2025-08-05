import { useEffect } from 'react';

import { useRootLoaderData } from '~/root';

import * as themes from '../../plugins/misc';

export const useThemeChange = () => {
  const { settings } = useRootLoaderData()!;
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
