import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

export const BasicAuth: FC<{ disabled?: boolean }> = ({ disabled = false }) => (
  <AuthTableBody>
    <AuthToggleRow label="Enabled" property="disabled" invert disabled={disabled} />
    <AuthInputRow label="Username" property="username" disabled={disabled} />
    <AuthInputRow label="Password" property="password" mask disabled={disabled} />
    <AuthToggleRow
      label="Use ISO 8859-1"
      help="Check this to use ISO-8859-1 encoding instead of default UTF-8"
      property='useISO88591'
      disabled={disabled}
    />
  </AuthTableBody>
);
