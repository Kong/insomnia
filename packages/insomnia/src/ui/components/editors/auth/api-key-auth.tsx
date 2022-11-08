import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthSelectRow } from './components/auth-select-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

export const ApiKeyAuth: FC<{ disabled?: boolean }> = ({ disabled = false }) => (
  <AuthTableBody>
    <AuthToggleRow label="Enabled" property="disabled" invert disabled={disabled} />
    <AuthInputRow label='Key' property='key' disabled={disabled} />
    <AuthInputRow label='Value' property='value' disabled={disabled} />
    <AuthSelectRow label='Add to' property='addTo' options={[{ name: 'Header', value: 'header' }, { name: 'Query params', value: 'queryParams' }]} disabled={disabled} />
  </AuthTableBody>
);
