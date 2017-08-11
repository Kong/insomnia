// @flow
import React from 'react';
import autobind from 'autobind-decorator';
import Tooltip from './tooltip';

@autobind
class HelpTooltip extends React.PureComponent {
  props: {
    children: React.Children,

    // Optional
    position?: string,
    className?: string,
    info?: boolean
  };

  render () {
    const {children, className, info, ...props} = this.props;
    return (
      <Tooltip {...props} position="top" className={className} message={children}>
        <i className={'fa ' + (info ? 'fa-info-circle' : 'fa-question-circle')}/>
      </Tooltip>
    );
  }
}

export default HelpTooltip;
