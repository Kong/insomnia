import React, { FC } from 'react';

import { AuthToggleRow } from './auth-toggle-row';

export const AuthEnabledRow: FC = () => <AuthToggleRow label="Enabled" property="disabled" invert />;
