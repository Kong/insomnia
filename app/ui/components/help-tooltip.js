import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Tooltip from './tooltip';

@autobind
class HelpTooltip extends PureComponent {
  render () {
    const {children, ...props} = this.props;
    return (
      <Tooltip {...props} message={children}>
        <i className="fa fa-question-circle"/>
      </Tooltip>
    );
  }
}

HelpTooltip.propTypes = {
  children: PropTypes.node.isRequired,

  // Optional
  position: PropTypes.string
};

export default HelpTooltip;
