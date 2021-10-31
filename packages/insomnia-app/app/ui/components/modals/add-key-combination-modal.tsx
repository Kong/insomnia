import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { KeyCombination } from 'insomnia-common';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { constructKeyCombinationDisplay, isModifierKeyCode } from '../../../common/hotkeys';
import { keyboardKeys } from '../../../common/keyboard-keys';
import * as misc from '../../../common/misc';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

interface State {
  hotKeyRefId: string | null;
  checkKeyCombinationDuplicate: (...args: any[]) => any;
  onAddKeyCombination: (...args: any[]) => any;
  pressedKeyCombination: KeyCombination | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class AddKeyCombinationModal extends PureComponent<{}, State> {
  _modal: Modal | null = null;

  state: State = {
    hotKeyRefId: null,
    checkKeyCombinationDuplicate: misc.nullFn,
    onAddKeyCombination: misc.nullFn,
    pressedKeyCombination: null,
  };

  _setModalRef(modal: Modal) {
    this._modal = modal;
  }

  _handleKeyDown(e: KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Handle keypress without modifiers.
    if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      // esc key is for closing dialog, don't record it.
      if (e.keyCode === keyboardKeys.esc.keyCode) {
        // Hiding modal is already handled by underlying modal.
        return;
      }

      // enter key is for saving previously entered key combination, don't record it.
      if (e.keyCode === keyboardKeys.enter.keyCode) {
        const {
          hotKeyRefId,
          checkKeyCombinationDuplicate,
          onAddKeyCombination,
          pressedKeyCombination,
        } = this.state;

        // Exit immediately if no key combination is pressed,
        // pressed key code is unknown,
        // or pressed key combination is incomplete (only modifiers are pressed).
        if (
          pressedKeyCombination == null ||
          pressedKeyCombination.keyCode === 0 ||
          isModifierKeyCode(pressedKeyCombination.keyCode)
        ) {
          this.hide();
          return;
        }

        // Reject duplicate key combination.
        if (checkKeyCombinationDuplicate(pressedKeyCombination)) {
          return;
        }

        // Accept new key combination.
        onAddKeyCombination(hotKeyRefId, pressedKeyCombination);
        this.hide();
        return;
      }
    }

    const pressed: KeyCombination = {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      meta: e.metaKey,
      keyCode: e.keyCode,
    };
    this.setState({
      pressedKeyCombination: pressed,
    });
  }

  show(
    hotKeyRefId: string,
    checkKeyCombinationDuplicate: (...args: any[]) => any,
    onAddKeyCombination: (...args: any[]) => any,
  ) {
    this.setState({
      hotKeyRefId: hotKeyRefId,
      checkKeyCombinationDuplicate: checkKeyCombinationDuplicate,
      onAddKeyCombination: onAddKeyCombination,
      pressedKeyCombination: null,
    });
    this._modal?.show();
  }

  hide() {
    this._modal?.hide();
  }

  render() {
    const { checkKeyCombinationDuplicate, pressedKeyCombination } = this.state;
    let keyCombDisplay = '';
    let isDuplicate = false;

    if (pressedKeyCombination != null) {
      keyCombDisplay = constructKeyCombinationDisplay(pressedKeyCombination, true).toLowerCase();
      isDuplicate = checkKeyCombinationDuplicate(pressedKeyCombination);
    }

    const duplicateMessageClasses = classnames('margin-bottom margin-left faint italic txt-md', {
      hidden: !isDuplicate,
    });
    return (
      <Modal
        ref={this._setModalRef}
        onKeyDown={this._handleKeyDown}
        className="shortcuts add-key-comb-modal"
      >
        <ModalHeader>Add Keyboard Shortcut</ModalHeader>
        <ModalBody noScroll>
          <div className="pad-left pad-right pad-top pad-bottom-sm">
            <div className="form-control form-control--outlined">
              <label>
                Press desired key combination and then press ENTER.
                <input type="text" className="key-comb" value={keyCombDisplay} disabled />
              </label>
            </div>
          </div>
          <div className={duplicateMessageClasses}>Duplicate key combination</div>
        </ModalBody>
      </Modal>
    );
  }
}
