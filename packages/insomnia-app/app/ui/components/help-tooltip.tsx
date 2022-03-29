import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent, ReactNode } from 'react';
import { CSSProperties } from 'styled-components';

import { AUTOBIND_CFG } from '../../common/constants';
import { Tooltip } from './tooltip';

interface Props {
  children: ReactNode;
  position?: string;
  className?: string;
  style?: CSSProperties;
  info?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class HelpTooltip extends PureComponent<Props> {
  render() {
    const { children, className, style, info } = this.props;
    return (
      <Tooltip
        position="top"
        className={className}
        message={children}
        // @ts-expect-error -- TSCONVERSION appears to be a genuine error because style is not accepted or used or spread by Tooltip
        style={style}
      >
        <i className={'fa ' + (info ? 'fa-info-circle' : 'fa-question-circle')} />
      </Tooltip>
    );
  }
}
