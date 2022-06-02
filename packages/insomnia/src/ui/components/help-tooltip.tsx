import React, { FC, ReactNode } from 'react';
import { CSSProperties } from 'styled-components';

import { Tooltip } from './tooltip';

interface Props {
  children: ReactNode;
  position?: string;
  className?: string;
  style?: CSSProperties;
  info?: boolean;
}

export const HelpTooltip: FC<Props> = props => {
  const {
    children,
    className,
    style,
    info,
  } = props;
  return <Tooltip
    position="top"
    className={className}
    message={children}
    // @ts-expect-error -- TSCONVERSION appears to be a genuine error because style is not accepted or used or spread by Tooltip
    style={style}
  >
    <i className={'fa ' + (info ? 'fa-info-circle' : 'fa-question-circle')} />
  </Tooltip>;
};
