import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthToggleRow } from './components/auth-toggle-row';

export const BasicAuth: FC = () => {
  return (
    <>
      <AuthInputRow label="Username" property="username" />
      <AuthInputRow label="Password" property="password" mask />
      <AuthToggleRow
        label="Use ISO 8859-1"
        property="useISO88591"
        help="Check this to use ISO-8859-1 encoding instead of default UTF-8"
      />
      <AuthToggleRow label="Enabled" property="disabled" invert />
    </>
  );
};
