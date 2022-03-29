import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthTableBody } from './components/auth-table-body';

export const DigestAuth: FC = () => (
  <AuthTableBody>
    <AuthInputRow label='Username' property='username' />
    <AuthInputRow label='Password' property='password' mask />
  </AuthTableBody>
);
