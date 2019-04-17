import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import KeydownBinder from '../keydown-binder';
import { hotKeyRefs } from '../../../common/hotkeys';
import { pressedHotKey } from '../../../common/hotkeys-listener';

// Keep global z-index reference so that every modal will
// appear over top of an existing one.
let globalZIndex = 1000;

@autobind
class Modal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      open: false,
      forceRefreshCounter: 0,
      zIndex: globalZIndex,
    };
  }

  async _handleKeyDown(e) {
    if (!this.state.open) {
      return;
    }

    // Don't check for close keys if we don't want them
    if (this.props.noEscape) {
      return;
    }

    const closeOnKeyCodes = this.props.closeOnKeyCodes || [];
    const pressedEscape = await pressedHotKey(e, hotKeyRefs.CLOSE_MODAL);
    const pressedCloseButton = closeOnKeyCodes.find(c => c === e.keyCode);

    // Pressed escape
    if (pressedEscape || pressedCloseButton) {
      e.preventDefault();
      this.hide();
      this.props.onCancel && this.props.onCancel();
    }
  }

  _handleClick(e) {
    // Don't check for close keys if we don't want them
    if (this.props.noEscape) {
      return;
    }

    // Did we click a close button. Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?
    let target = e.target;
    let shouldHide = false;

    for (let i = 0; i < 5; i++) {
      if (target instanceof HTMLElement && target.hasAttribute('data-close-modal')) {
        shouldHide = true;
        break;
      }

      target = target.parentNode;
    }

    if (shouldHide) {
      this.hide();
      this.props.onCancel && this.props.onCancel();
    }
  }

  _setModalRef(n) {
    this._node = n;
  }

  show(options) {
    const { freshState } = this.props;
    const { forceRefreshCounter } = this.state;

    this.setState({
      open: true,
      zIndex: globalZIndex++,
      forceRefreshCounter: forceRefreshCounter + (freshState ? 1 : 0),
    });

    if (this.props.dontFocus) {
      return;
    }

    // Allow instance-based onHide method
    this.onHide = options ? options.onHide : null;

    setTimeout(() => this._node && this._node.focus());
  }

  toggle() {
    if (this.state.open) {
      this.hide();
    } else {
      this.show();
    }
  }

  isOpen() {
    return this.state.open;
  }

  hide() {
    this.setState({ open: false });
    this.props.onHide && this.props.onHide();
    this.onHide && this.onHide();
  }

  render() {
    const { tall, wide, noEscape, className, children } = this.props;
    const { open, zIndex, forceRefreshCounter } = this.state;

    if (!open) {
      return null;
    }

    const classes = classnames(
      'modal',
      'theme--dialog',
      className,
      { 'modal--fixed-height': tall },
      { 'modal--noescape': noEscape },
      { 'modal--wide': wide },
    );

    const styles = {};
    if (open) {
      styles.zIndex = zIndex;
    }
    console.log('OPEN', open);

    return (
      <KeydownBinder stopMetaPropagation scoped onKeydown={this._handleKeyDown}>
        <div
          ref={this._setModalRef}
          tabIndex="-1"
          className={classes}
          style={styles}
          aria-hidden={!open}
          onClick={this._handleClick}>
          <div className="modal__backdrop overlay theme--transparent-overlay" data-close-modal />
          <div className="modal__content__wrapper">
            <div className="modal__content" key={forceRefreshCounter}>
              {children}
            </div>
          </div>
        </div>
      </KeydownBinder>
    );
  }
}

Modal.propTypes = {
  tall: PropTypes.bool,
  wide: PropTypes.bool,
  noEscape: PropTypes.bool,
  dontFocus: PropTypes.bool,
  closeOnKeyCodes: PropTypes.array,
  onHide: PropTypes.func,
  onCancel: PropTypes.func,
  freshState: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
};

export default Modal;
