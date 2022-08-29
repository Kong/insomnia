import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

export const NTLMAuth: FC = () => (
  <AuthTableBody>
    <AuthToggleRow label="Enabled" property="disabled" invert />
    <AuthInputRow label="Username" property="username" />
    <AuthInputRow label="Password" property="password" mask />
  </AuthTableBody>
);
