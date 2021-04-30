import React, { PureComponent, ReactNode } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import Tooltip from './tooltip';
import { AUTOBIND_CFG } from '../../common/constants';

interface Props {
  children: ReactNode;
  position?: string;
  className?: string;
  style?: Record<string, any>;
  info?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class HelpTooltip extends PureComponent<Props> {
  render() {
    const { children, className, style, info } = this.props;
    return (
      <Tooltip position="top" className={className} message={children} style={style}>
        <i className={'fa ' + (info ? 'fa-info-circle' : 'fa-question-circle')} />
      </Tooltip>
    );
  }
}

export default HelpTooltip;
