import { useEffect } from 'react';
import { useSelector } from 'react-redux';

import * as themes from '../../plugins/misc';
import { selectSettings } from '../redux/selectors';

export const useThemeChange = () => {
  const settings = useSelector(selectSettings);
  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    matches.addEventListener('change', () => themes.applyColorScheme(settings));
    return () => {
      matches.removeEventListener('change', () => themes.applyColorScheme(settings));
    };
  });
};
