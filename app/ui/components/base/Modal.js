import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import {isMac} from '../../../common/constants';

// Keep global z-index reference so that every modal will
// appear over top of an existing one.
let globalZIndex = 1000;

@autobind
class Modal extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      open: false,
      forceRefreshCounter: 0,
      zIndex: globalZIndex
    };
  }

  _setModalRef (n) {
    this._node = n;
    this._addListener();
  }

  _addListener () {
    this._node.addEventListener('keydown', this._handleKeyDown);
  }

  _removeListener () {
    this._node.removeEventListener('keydown', this._handleKeyDown);
  }

  _handleKeyDown (e) {
    if (!this.state.open) {
      return;
    }

    // Don't bubble up meta events up past the modal no matter what
    // Example: ctrl+Enter to send requests
    const isMeta = isMac() ? e.metaKey : e.ctrlKey;
    if (isMeta) {
      e.stopPropagation();
    }

    // Don't check for close keys if we don't want them
    if (this.props.noEscape) {
      return;
    }

    const closeOnKeyCodes = this.props.closeOnKeyCodes || [];
    const pressedEscape = e.keyCode === 27;
    const pressedElse = closeOnKeyCodes.find(c => c === e.keyCode);

    if (pressedEscape || pressedElse) {
      e.preventDefault();
      // Pressed escape
      this.hide();
    }
  }

  _handleClick (e) {
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
    const {freshState} = this.props;
    const {forceRefreshCounter} = this.state;

    this.setState({
      open: true,
      zIndex: globalZIndex++,
      forceRefreshCounter: forceRefreshCounter + (freshState ? 1 : 0)
    });

    if (this.props.dontFocus) {
      return;
    }

    setTimeout(() => this._node && this._node.focus());
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

  componentWillUnmount () {
    this._removeListener();
  }

  render () {
    const {tall, top, wide, noEscape, className} = this.props;
    const {open, zIndex, forceRefreshCounter} = this.state;

    const classes = classnames(
      'modal',
      className,
      {'modal--open': open},
      {'modal--fixed-height': tall},
      {'modal--fixed-top': top},
      {'modal--noescape': noEscape},
      {'modal--wide': wide},
    );

    return (
      <div ref={this._setModalRef}
           tabIndex="-1"
           className={classes}
           style={{zIndex: zIndex}}
           onClick={this._handleClick}>
        <div className="modal__content" key={forceRefreshCounter}>
          <div className="modal__backdrop overlay" data-close-modal></div>
          {this.props.children}
        </div>
      </div>
    );
  }
}

Modal.propTypes = {
  tall: PropTypes.bool,
  top: PropTypes.bool,
  wide: PropTypes.bool,
  noEscape: PropTypes.bool,
  dontFocus: PropTypes.bool,
  closeOnKeyCodes: PropTypes.array,
  freshState: PropTypes.bool
};

export default Modal;
