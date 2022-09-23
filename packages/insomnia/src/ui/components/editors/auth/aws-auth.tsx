import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthTableBody } from './components/auth-table-body';
import { AuthToggleRow } from './components/auth-toggle-row';

export const AWSAuth: FC = () => (
  <AuthTableBody>
    <AuthToggleRow label="Enabled" property="disabled" invert />
    <AuthInputRow
      label="Access Key ID"
      property="accessKeyId"
    />
    <AuthInputRow
      label="Secret Access Key"
      property="secretAccessKey"
    />
    <AuthInputRow
      label="Region"
      property="region"
      help="Will be calculated from hostname or host or use 'us-east-1' if not given"
    />
    <AuthInputRow
      label="Service"
      property="service"
      help="Will be calculated from hostname or host if not given"
    />
    <AuthInputRow
      label="Session Token"
      property="sessionToken"
      help="Optional token used for multi-factor authentication"
    />
  </AuthTableBody>
);
