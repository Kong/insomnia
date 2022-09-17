import React, { FC } from 'react';

interface AuthRowProps {
  className?: string;
}

export const AuthRow: FC<AuthRowProps> = ({ className, children }) => {
  return (
    <div className="form-row">
      <div className={className || 'form-control form-control--outlined'}>
        {children}
      </div>
    </div>
  );
};
