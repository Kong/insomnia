// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Tooltip from './tooltip';
import SvgIcon from './svg-icon';

type Props = {
  children: React.Node,

  // Optional
  position?: 'bottom' | 'top' | 'right' | 'left',
  delay?: number,
  className?: string,
  style?: Object,
  info?: boolean,
};

@autobind
class HelpTooltip extends React.PureComponent<Props> {
  render() {
    const { children, className, style, info, position, delay } = this.props;
    return (
      <Tooltip
        position={position}
        delay={delay}
        className={className}
        message={children}
        style={style}>
        {info ? <SvgIcon icon="info" /> : <SvgIcon icon="question" />}
      </Tooltip>
    );
  }
}

export default HelpTooltip;
