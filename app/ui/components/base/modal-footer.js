import React, {PropTypes, PureComponent} from 'react';
import classnames from 'classnames';

class ModalFooter extends PureComponent {
  render () {
    const {children, className} = this.props;
    return (
      <div className={classnames('modal__footer', className)}>
        {children}
      </div>
    );
  }
}

ModalFooter.propTypes = {
  // Required
  children: PropTypes.node.isRequired,

  // Optional
  className: PropTypes.string
};

export default ModalFooter;
