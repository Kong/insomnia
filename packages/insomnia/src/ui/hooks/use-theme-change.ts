import { useEffect } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import * as themes from '../../plugins/misc';
import { OrganizationLoaderData } from '../routes/organization';

export const useThemeChange = () => {
  const {
    settings,
  } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    matches.addEventListener('change', () => themes.applyColorScheme(settings));
    return () => {
      matches.removeEventListener('change', () => themes.applyColorScheme(settings));
    };
  });
};
