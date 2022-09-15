import React, { FC } from 'react';

import { AuthInputRow } from './components/auth-input-row';
import { AuthToggleRow } from './components/auth-toggle-row';

export const BearerAuth: FC = () => {
  return (
    <>
      <AuthInputRow label="Token" property="token" />
      <AuthInputRow label="Prefix" property="prefix" />
      <AuthToggleRow label="Enabled" property="disabled" invert />
    </>
  );
};
