import React, {PureComponent, PropTypes} from 'react';
import classnames from 'classnames';

class ModalBody extends PureComponent {
  render () {
    const {className, children, noScroll, ...props} = this.props;
    return (
      <div className={classnames('modal__body', {
        'modal__body--no-scroll': noScroll
      }, className)} {...props}>
        {children}
      </div>
    );
  }
}

ModalBody.propTypes = {
  noScroll: PropTypes.bool
};

export default ModalBody;
