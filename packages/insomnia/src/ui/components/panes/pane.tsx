import classnames from 'classnames';
import React, { FC, PropsWithChildren } from 'react';

interface PaneProps {
  className?: string;
  type: 'request' | 'response';
}

interface PaneHeaderProps {
  className?: string;
}

interface PaneBodyProps {
  className?: string;
  placeholder?: boolean;
}

export const Pane: FC<PropsWithChildren<PaneProps>> = ({ className, type, children }) => (
  <section className={classnames(`${type}-pane`, 'theme--pane', 'pane', className)} data-testid={`${type}-pane`}>
    {children}
  </section>
);

export const PaneHeader: FC<PropsWithChildren<PaneHeaderProps>> = ({ className, children }) => (
  <header className={classnames('pane__header', 'theme--pane__header', className)}>
    {children}
  </header>
);

export const paneBodyClasses = 'pane__body theme--pane__body';
export const PaneBody: FC<PropsWithChildren<PaneBodyProps>> = ({ placeholder, children }) => (
  <div className={classnames(paneBodyClasses, placeholder && 'pane__body--placeholder')}>
    {children}
  </div>
);
