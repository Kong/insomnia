import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import {isMac} from '../../../common/constants';

// Keep global z-index reference so that every modal will
// appear over top of an existing one.
let globalZIndex = 1000;

class Modal extends Component {
  state = {open: false, zIndex: globalZIndex};

  _handleClick (e) {
    // Did we click a close button. Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?
    let target = e.target;
    let shouldHide = false;

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

  isShown () {
    return this.state.open;
  }

  show () {
    this.setState({open: true, zIndex: globalZIndex++});

    if (this.props.dontFocus) {
      return;
    }

    setTimeout(() => {
      this._node && this._node.focus();
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

  componentDidMount () {
    // In order for this to work, there needs to be tabIndex of -1 on the modal container
    this._keydownCallback = e => {
      if (!this.state.open) {
        return;
      }

      // Don't bubble up meta events up past the modal no matter what
      // Example: ctrl+Enter to send requests
      const isMeta = isMac() ? e.metaKey : e.ctrlKey;
      if (isMeta) {
        e.stopPropagation();
      }

      const closeOnKeyCodes = this.props.closeOnKeyCodes || [];
      const pressedEscape = e.keyCode === 27;
      const pressedElse = closeOnKeyCodes.find(c => c === e.keyCode);

      if (pressedEscape || pressedElse) {
        e.preventDefault();
        // Pressed escape
        this.hide();
      }
    };

    this._node.addEventListener('keydown', this._keydownCallback);
  }

  componentWillUnmount () {
    this._node.removeEventListener('keydown', this._keydownCallback);
  }

  render () {
    const {tall, top, wide, className} = this.props;
    const {open, zIndex} = this.state;

    const classes = classnames(
      'modal',
      className,
      {'modal--open': open},
      {'modal--fixed-height': tall},
      {'modal--fixed-top': top},
      {'modal--wide': wide},
    );

    return (
      <div ref={n => this._node = n} tabIndex="-1" className={classes}
           style={{zIndex: zIndex}}
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
  tall: PropTypes.bool,
  top: PropTypes.bool,
  wide: PropTypes.bool,
  dontFocus: PropTypes.bool,
  closeOnKeyCodes: PropTypes.array
};

export default Modal;

