import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

export const BearerAuth: FC<{ disabled?: boolean }> = ({ disabled = false }) => (
  <AuthTableBody>
    <AuthToggleRow label="Enabled" property="disabled" invert disabled={disabled} />
    <AuthInputRow label='Token' property='token' disabled={disabled} />
    <AuthInputRow label='Prefix' property='prefix' disabled={disabled} />
  </AuthTableBody>
);
