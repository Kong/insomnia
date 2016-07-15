import React, {Component, PropTypes} from 'react'
import classnames from 'classnames'

import Mousetrap from '../../lib/mousetrap'

class Modal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      open: false
    };
  }

  _handleClick (e) {
    // Did we click a close button. Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?
    let target = e.target;
    let shouldHide = false;

    if (target === this.refs.modal) {
      shouldHide = true;
    }

    for (let i = 0; i < 5; i++) {
      if (target.hasAttribute('data-close-modal')) {
        shouldHide = true;
        break;
      }

      target = target.parentNode;
    }

    if (shouldHide) {
      this.hide();
    }
  }

  show () {
    this.setState({open: true});

    Mousetrap.bindGlobal('esc', () => {
      this.hide();
    });
  }

  toggle () {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  hide () {
    this.setState({open: false});
  }

  render () {
    const {tall, className} = this.props;
    const {open} = this.state;

    const classes = classnames(
      'modal',
      className,
      {'modal--open': open},
      {'modal--fixed-height': tall}
    );

    return (
      <div
        className={classes}
        onClick={this._handleClick.bind(this)}>

        <div className="modal__content">
          <div className="modal__backdrop" onClick={() => this.hide()}></div>
          {this.props.children}
        </div>
      </div>
    )
  }
}

Modal.propTypes = {
  tall: PropTypes.bool
};

export default Modal;

