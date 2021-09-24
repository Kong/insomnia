import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { CSSProperties, PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { pressedHotKey } from '../../../common/hotkeys-listener';
import { KeydownBinder } from '../keydown-binder';
// Keep global z-index reference so that every modal will
// appear over top of an existing one.
let globalZIndex = 1000;

export interface ModalProps {
  tall?: boolean;
  wide?: boolean;
  skinny?: boolean;
  noEscape?: boolean;
  dontFocus?: boolean;
  closeOnKeyCodes?: any[];
  onShow?: Function;
  onHide?: Function;
  onCancel?: Function;
  onKeyDown?: Function;
  freshState?: boolean;
  children?: ReactNode;
  className?: string;
}

interface State {
  open: boolean;
  forceRefreshCounter: number;
  zIndex: number;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Modal extends PureComponent<ModalProps, State> {
  onHide: Function | null = null;
  _node: HTMLDivElement | null = null;

  state: State = {
    open: false,
    forceRefreshCounter: 0,
    zIndex: globalZIndex,
  };

  async _handleKeyDown(e) {
    if (!this.state.open) {
      return;
    }

    this.props.onKeyDown?.(e);

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
      this.props.onCancel?.();
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
      this.props.onCancel?.();
    }
  }

  _setModalRef(n: HTMLDivElement) {
    this._node = n;
  }

  show(options?: ModalProps) {
    const { freshState } = this.props;
    const { forceRefreshCounter } = this.state;

    this.setState({
      open: true,
      zIndex: globalZIndex++,
      forceRefreshCounter: forceRefreshCounter + (freshState ? 1 : 0),
    });

    this.props.onShow?.();

    if (this.props.dontFocus) {
      return;
    }

    // Allow instance-based onHide method
    this.onHide = options?.onHide ?? null;
    setTimeout(() => this._node?.focus());
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
    this.setState({
      open: false,
    });
    this.props.onHide?.();
    this.onHide?.();
  }

  render() {
    const { tall, wide, skinny, noEscape, className, children } = this.props;
    const { open, zIndex, forceRefreshCounter } = this.state;

    if (!open) {
      return null;
    }

    const classes = classnames(
      'modal',
      'theme--dialog',
      className,
      {
        'modal--fixed-height': tall,
      },
      {
        'modal--noescape': noEscape,
      },
      {
        'modal--wide': wide,
      },
      {
        'modal--skinny': skinny,
      },
    );
    const styles: CSSProperties = {};

    if (open) {
      styles.zIndex = zIndex;
    }

    return (
      <KeydownBinder stopMetaPropagation scoped onKeydown={this._handleKeyDown}>
        <div
          ref={this._setModalRef}
          tabIndex={-1}
          className={classes}
          style={styles}
          aria-hidden={!open}
          onClick={this._handleClick}
        >
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
