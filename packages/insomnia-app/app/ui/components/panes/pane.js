// @flow
import classnames from 'classnames';
import React from 'react';

type PaneProps = {
  className?: string,
  type: 'request' | 'response',
};

type PaneHeaderProps = {
  className?: string,
};

type PaneBodyProps = {
  className?: string,
  placeholder?: boolean,
};

export const Pane = ({ className, type, children }: PaneProps) => (
  <section className={classnames(`${type}-pane`, 'theme--pane', 'pane', className)}>
    {children}
  </section>
);

export const PaneHeader = ({ className, children }: PaneHeaderProps) => (
  <header className={classnames('pane__header', 'theme--pane__header', className)}>
    {children}
  </header>
);

export const paneBodyClasses = 'pane__body theme--pane__body';

export const PaneBody = ({ placeholder, children }: PaneBodyProps) => (
  <div className={classnames(paneBodyClasses, placeholder && 'pane__body--placeholder')}>
    {children}
  </div>
);
