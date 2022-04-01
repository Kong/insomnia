import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthPrivateKeyRow } from './components/auth-private-key-row';
import { AuthTableBody } from './components/auth-table-body';

export const AsapAuth: FC = () => (
  <AuthTableBody>
    <AuthInputRow label='Issuer (iss)' property='issuer' />
    <AuthInputRow label='Subject (sub)' property='subject' />
    <AuthInputRow label='Audience (aud)' property='audience' />
    <AuthInputRow label='Additional Claims' property='additionalClaims' mode='application/json' />
    <AuthInputRow label='Key ID (kid)' property='keyId' />
    <AuthPrivateKeyRow
      label='Private Key'
      property='privateKey'
      help='Can also use single line data-uri format (e.g. obtained from asap-cli export-as-data-uri command), useful for saving as environment data'
    />
  </AuthTableBody>
);
