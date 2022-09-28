import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { KeyboardShortcut, KeyCombination } from 'insomnia-common';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { constructKeyCombinationDisplay, isModifierKeyCode } from '../../../common/hotkeys';
import { keyboardKeys } from '../../../common/keyboard-keys';
import { type ModalHandle, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

interface State {
  keyboardShortcut: KeyboardShortcut | null;
  checkKeyCombinationDuplicate: (pressedKeyComb: KeyCombination) => boolean;
  onAddKeyCombination: (keyboardShortcut: KeyboardShortcut, keyComb: KeyCombination) => void;
  pressedKeyCombination: KeyCombination | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class AddKeyCombinationModal extends PureComponent<{}, State> {
  _modal: ModalHandle | null = null;

  state: State = {
    keyboardShortcut: null,
    checkKeyCombinationDuplicate: () => false,
    onAddKeyCombination: () => {},
    pressedKeyCombination: null,
  };

  _setModalRef(modal: ModalHandle) {
    this._modal = modal;
  }

  _handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    event.preventDefault();
    event.stopPropagation();

    // Handle keypress without modifiers.
    if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
      // esc key is for closing dialog, don't record it.
      if (event.keyCode === keyboardKeys.esc.keyCode) {
        // Hiding modal is already handled by underlying modal.
        return;
      }

      // enter key is for saving previously entered key combination, don't record it.
      if (event.keyCode === keyboardKeys.enter.keyCode) {
        const {
          keyboardShortcut,
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
        if (!keyboardShortcut) {
          return;
        }
        // Accept new key combination.
        onAddKeyCombination(keyboardShortcut, pressedKeyCombination);
        this.hide();
        return;
      }
    }

    const pressed: KeyCombination = {
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
      keyCode: event.keyCode,
    };
    this.setState({
      pressedKeyCombination: pressed,
    });
  }

  show(
    keyboardShortcut: KeyboardShortcut,
    checkKeyCombinationDuplicate: (...args: any[]) => any,
    onAddKeyCombination: (...args: any[]) => any,
  ) {
    this.setState({
      keyboardShortcut: keyboardShortcut,
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
      keyCombDisplay = constructKeyCombinationDisplay(pressedKeyCombination, true);
      isDuplicate = checkKeyCombinationDuplicate(pressedKeyCombination);
    }

    const duplicateMessageClasses = classnames('margin-bottom margin-left faint italic txt-md', {
      hidden: !isDuplicate,
    });

    return (
      <Modal
        ref={this._setModalRef}
        className="shortcuts add-key-comb-modal"
      >
        <ModalHeader>Add Keyboard Shortcut</ModalHeader>
        <ModalBody noScroll>
          <div className="pad-left pad-right pad-top pad-bottom-sm">
            <div className="form-control form-control--outlined">
              <label>
                Press desired key combination and then press ENTER.
                <input onKeyDown={this._handleKeyDown} autoFocus type="text" className="key-comb" value={keyCombDisplay} readOnly />
              </label>
            </div>
          </div>
          <div className={duplicateMessageClasses}>Duplicate key combination</div>
        </ModalBody>
      </Modal>
    );
  }
}
