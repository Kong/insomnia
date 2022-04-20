import React, { FC, ReactNode } from 'react';

import { AuthEnabledRow } from './auth-enabled-row';

export const AuthTableBody: FC<{children: ReactNode}> = ({ children }) => (
  <div className="pad">
    <table>
      <tbody>
        <AuthEnabledRow />
        {children}
      </tbody>
    </table>
  </div>);
