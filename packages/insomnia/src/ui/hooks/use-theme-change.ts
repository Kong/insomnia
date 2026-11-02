import { useEffect } from 'react';

import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';
import * as themes from '~/ui/plugins/misc';

export const useThemeChange = () => {
  const rootLoaderData = useRootLoaderData();
  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      console.log(`Applying theme:`);
      rootLoaderData && themes.applyColorScheme(rootLoaderData.settings);
    };
    matches.addEventListener('change', applyTheme);
    return () => {
      matches.removeEventListener('change', applyTheme);
    };
  });
};
