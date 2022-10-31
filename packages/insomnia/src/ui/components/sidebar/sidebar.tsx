import classnames from 'classnames';
import React, { forwardRef, memo, ReactNode } from 'react';

import {
  COLLAPSE_SIDEBAR_REMS,
  SIDEBAR_SKINNY_REMS,
} from '../../../common/constants';

interface Props {
  children: ReactNode;
  hidden: boolean;
  width: number;
}

export const Sidebar = memo(
  forwardRef<HTMLElement, Props>(({
    children,
    hidden,
    width,
  }, ref) => {
    return (
      <aside
        ref={ref}
        className={classnames('sidebar', 'theme--sidebar', {
          'sidebar--hidden': hidden,
          'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
          'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS,
        })}
      >
        {children}
      </aside>
    );
  })
);

Sidebar.displayName = 'Sidebar';
