import React, { CSSProperties, FC, ReactNode } from 'react';

import { SvgIcon } from './svg-icon';
import { Tooltip } from './tooltip';

interface Props {
  children: ReactNode;
  position?: 'bottom' | 'top' | 'right' | 'left';
  delay?: number;
  className?: string;
  style?: CSSProperties;
  info?: boolean;
}

export const HelpTooltip: FC<Props> = ({
  children,
  className,
  style,
  info,
  position,
  delay,
}) => (
  <Tooltip
    position={position}
    delay={delay}
    className={className}
    message={children}
    style={style}
  >
    {info ? <SvgIcon icon="info" /> : <SvgIcon icon="question-fill"  />}
  </Tooltip>
);
