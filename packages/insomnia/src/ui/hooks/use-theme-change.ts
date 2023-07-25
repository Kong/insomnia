import { useEffect } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import * as themes from '../../plugins/misc';
import { RootLoaderData } from '../routes/root';

export const useThemeChange = () => {
  const {
    settings,
  } = useRouteLoaderData('root') as RootLoaderData;
  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    matches.addEventListener('change', () => themes.applyColorScheme(settings));
    return () => {
      matches.removeEventListener('change', () => themes.applyColorScheme(settings));
    };
  });
};
