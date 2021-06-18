import React, { CSSProperties, PureComponent, ReactNode } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { Tooltip } from './tooltip';
import { SvgIcon } from './svg-icon';

interface Props {
  children: ReactNode;
  position?: 'bottom' | 'top' | 'right' | 'left';
  delay?: number;
  className?: string;
  style?: CSSProperties;
  info?: boolean;
}

@autoBindMethodsForReact
export class HelpTooltip extends PureComponent<Props> {
  render() {
    const { children, className, style, info, position, delay } = this.props;
    return (
      <Tooltip
        position={position}
        delay={delay}
        className={className}
        message={children}
        style={style}
      >
        {info ? <SvgIcon icon="info" /> : <SvgIcon icon="question" />}
      </Tooltip>
    );
  }
}
