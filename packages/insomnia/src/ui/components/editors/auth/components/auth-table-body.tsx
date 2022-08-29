import React, { FC, ReactNode } from 'react';

export const AuthTableBody: FC<{children: ReactNode}> = ({ children }) => (
  <div className="pad">
    <table>
      <tbody>
        {children}
      </tbody>
    </table>
  </div>);
