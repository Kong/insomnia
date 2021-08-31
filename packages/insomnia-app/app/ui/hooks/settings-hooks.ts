import { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { setMenuBarVisibility } from '../../common/electron-helpers';
import { selectSettings } from '../redux/selectors';

export const useMenuBarVisibility = () => {
  const { autoHideMenuBar } = useSelector(selectSettings);

  useEffect(() => {
    setMenuBarVisibility(!autoHideMenuBar);
  }, [autoHideMenuBar]);
};
