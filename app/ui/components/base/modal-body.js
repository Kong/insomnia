import React, {PureComponent, PropTypes} from 'react';
import classnames from 'classnames';

class ModalBody extends PureComponent {
  render () {
    const {className, children, noScroll, ...props} = this.props;
    const classes = classnames(
      className,
      'modal__body',
      {'modal__body--no-scroll': noScroll}
    );

    return (
      <div className={classes} {...props}>
        {children}
      </div>
    );
  }
}

ModalBody.propTypes = {
  noScroll: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node
};

export default ModalBody;
