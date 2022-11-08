import React, { FC } from 'react';

import { COOKIE, HEADER, QUERY_PARAMS } from '../../../../network/api-key/constants';
import { AuthInputRow } from './components/auth-input-row';
import { AuthSelectRow } from './components/auth-select-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

export const options = [
  { name: 'Header', value: HEADER },
  { name: 'Query params', value: QUERY_PARAMS },
  { name: 'Cookie', value: COOKIE },
];

export const ApiKeyAuth: FC<{ disabled?: boolean }> = ({ disabled = false }) => (
  <AuthTableBody>
    <AuthToggleRow label="Enabled" property="disabled" invert disabled={disabled} />
    <AuthInputRow label='Key' property='key' disabled={disabled} />
    <AuthInputRow label='Value' property='value' mask disabled={disabled} />
    <AuthSelectRow label='Add to' property='addTo' options={options} disabled={disabled} />
  </AuthTableBody>
);
