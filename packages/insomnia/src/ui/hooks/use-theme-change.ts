import { useEffect } from 'react';

import * as themes from '../../plugins/misc';
import { useRootLoaderData } from '../routes/root';

export const useThemeChange = () => {
  const {
    settings,
  } = useRootLoaderData();
  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    matches.addEventListener('change', () => themes.applyColorScheme(settings));
    return () => {
      matches.removeEventListener('change', () => themes.applyColorScheme(settings));
    };
  });
};
