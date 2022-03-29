import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

export const BasicAuth: FC = () => (
  <AuthTableBody>
    <AuthInputRow label="Username" property="username" />
    <AuthInputRow label="Password" property="password" mask />
    <AuthToggleRow
      label="Use ISO 8859-1"
      help="Check this to use ISO-8859-1 encoding instead of default UTF-8"
      property='useISO88591'
    />
  </AuthTableBody>
);
