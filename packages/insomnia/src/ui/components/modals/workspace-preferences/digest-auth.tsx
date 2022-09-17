import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthToggleRow } from './components/auth-toggle-row';

export const DigestAuth: FC = () => {
  return (
    <>
      <AuthInputRow label="Username" property="username" />
      <AuthInputRow label="Password" property="password" mask />
      <AuthToggleRow label="Enabled" property="disabled" invert />
    </>
  );
};
