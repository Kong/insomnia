import { type ActionFunction, redirect } from 'react-router-dom';

import { logout } from '../../account/session';

export const action: ActionFunction = async () => {
  await logout();
  return redirect('/auth/login');
};
