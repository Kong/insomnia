import classnames from 'classnames';
import React, { FC, memo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

export const DropdownDivider: FC<Props> = memo(({ children }) => (
  <div
    className={classnames('dropdown__divider', {
      'dropdown__divider--no-name': !children,
    })}
  >
    <span className="dropdown__divider__label">{children}</span>
  </div>
));

DropdownDivider.displayName = 'DropdownDivider';
