import React, { FC } from 'react';

import {
  HAWK_ALGORITHM_SHA1,
  HAWK_ALGORITHM_SHA256,
} from '../../../../common/constants';
import { AuthInputRow } from './components/auth-input-row';
import { AuthSelectRow } from './components/auth-select-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

export const HawkAuth: FC = () => (
  <AuthTableBody>
    <AuthToggleRow label="Enabled" property="disabled" invert />
    <AuthInputRow label='Auth Id' property='id' />
    <AuthInputRow label='Auth Key' property='key' />
    <AuthSelectRow
      label='Algorithm'
      property='algorithm'
      options={[
        {
          name: HAWK_ALGORITHM_SHA256,
          value: HAWK_ALGORITHM_SHA256,
        },
        {
          name: HAWK_ALGORITHM_SHA1,
          value: HAWK_ALGORITHM_SHA1,
        },
      ]}
    />
    <AuthInputRow label='Ext' property='ext' />
    <AuthToggleRow label='Validate Payload' property='validatePayload' />
  </AuthTableBody>
);
