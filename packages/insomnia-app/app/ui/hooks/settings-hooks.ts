import { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { selectSettings } from '../redux/selectors';

export const useMenuBarVisibility = () => {
  const { autoHideMenuBar } = useSelector(selectSettings);

  useEffect(() => {
    window.main.setMenuBarVisibility(!autoHideMenuBar);
  }, [autoHideMenuBar]);
};
