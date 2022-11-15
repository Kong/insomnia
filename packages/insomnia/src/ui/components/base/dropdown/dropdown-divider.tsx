import classnames from 'classnames';
import React, { FC, ReactNode } from 'react';
interface Props {
  children?: ReactNode;
}
export const DropdownDivider: FC<Props> = ({ children }) => (
  <div
    className={classnames('dropdown__divider', {
      'dropdown__divider--no-name': !children,
    })}
  >
    <span className="dropdown__divider__label">{children}</span>
  </div>
);
