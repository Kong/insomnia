import classnames from 'classnames';
import React, { FC, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

export const DropdownDivider: FC<Props> = ({ children }) => {
  const classes = classnames('dropdown__divider', {
    'dropdown__divider--no-name': !children,
  });

  return (
    <div className={classes}>
      <span className="dropdown__divider__label">{children}</span>
    </div>
  );
};
