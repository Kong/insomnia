import classnames from 'classnames';
import React from 'react';

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

export const Pane: React.FC<PaneProps> = ({ className, type, children }) => (
  <section className={classnames(`${type}-pane`, 'theme--pane', 'pane', className)}>
    {children}
  </section>
);

export const PaneHeader: React.FC<PaneHeaderProps> = ({ className, children }) => (
  <header className={classnames('pane__header', 'theme--pane__header', className)}>
    {children}
  </header>
);

export const paneBodyClasses = 'pane__body theme--pane__body';
export const PaneBody: React.FC<PaneBodyProps> = ({ placeholder, children }) => (
  <div className={classnames(paneBodyClasses, placeholder && 'pane__body--placeholder')}>
    {children}
  </div>
);
