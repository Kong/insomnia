import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Tooltip from './tooltip';

@autobind
class HelpTooltip extends PureComponent {
  render () {
    const {children, className, ...props} = this.props;
    return (
      <Tooltip {...props} className={className} message={children}>
        <i className="fa fa-question-circle"/>
      </Tooltip>
    );
  }
}

HelpTooltip.propTypes = {
  children: PropTypes.node.isRequired,

  // Optional
  position: PropTypes.string,
  className: PropTypes.string
};

export default HelpTooltip;
