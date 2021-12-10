import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthTableBody } from './components/auth-table-body';

export const BearerAuth: FC = () => (
  <AuthTableBody>
    <AuthInputRow label='Token' property='token' />
    <AuthInputRow label='Prefix' property='prefix' />
  </AuthTableBody>
);
