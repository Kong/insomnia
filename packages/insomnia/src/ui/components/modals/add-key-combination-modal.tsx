import classnames from 'classnames';
import React, { forwardRef, KeyboardEvent, useImperativeHandle, useRef, useState } from 'react';

import { constructKeyCombinationDisplay, isModifierKeyCode } from '../../../common/hotkeys';
import { keyboardKeys } from '../../../common/keyboard-keys';
import { KeyCombination } from '../../../common/settings';
import { KeyboardShortcut } from '../../../common/settings';
import { Modal, ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

export interface AddKeyCombinationModalOptions {
  keyboardShortcut: KeyboardShortcut | null;
  checkKeyCombinationDuplicate: (pressedKeyComb: KeyCombination) => boolean;
  addKeyCombination: (keyboardShortcut: KeyboardShortcut, keyComb: KeyCombination) => void;
  pressedKeyCombination?: KeyCombination | null;
}
export interface AddKeyCombinationModalHandle {
  show: (options: AddKeyCombinationModalOptions) => void;
  hide: () => void;
}
export const AddKeyCombinationModal = forwardRef<AddKeyCombinationModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<AddKeyCombinationModalOptions>({
    keyboardShortcut: null,
    checkKeyCombinationDuplicate: () => false,
    addKeyCombination: () => {},
    pressedKeyCombination: null,
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      setState(options);
      modalRef.current?.show();
    },
  }), []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // Handle keypress without modifiers.
    if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
      // esc key is for closing dialog, don't record it.
      if (event.code === keyboardKeys.esc.code) {
        // Hiding modal is already handled by underlying modal.
        return;
      }
      // enter key is for saving previously entered key combination, don't record it.
      if (event.code === keyboardKeys.enter.code) {
        const { pressedKeyCombination } = state;
        // Exit immediately if no key combination is pressed,
        // pressed key code is unknown,
        // or pressed key combination is incomplete (only modifiers are pressed).
        if (
          pressedKeyCombination == null ||
          pressedKeyCombination.keyCode === 0 ||
          isModifierKeyCode(pressedKeyCombination.keyCode)
        ) {
          modalRef.current?.hide();
          return;
        }
        // Reject duplicate key combination.
        if (state.checkKeyCombinationDuplicate(pressedKeyCombination)) {
          return;
        }
        if (!state.keyboardShortcut) {
          return;
        }
        // Accept new key combination.
        state.addKeyCombination(state.keyboardShortcut, pressedKeyCombination);
        modalRef.current?.hide();
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
    setState({
      ...state,
      pressedKeyCombination: pressed,
    });
  };

  const { pressedKeyCombination } = state;
  let keyCombDisplay = '';
  let isDuplicate = false;

  if (pressedKeyCombination != null) {
    keyCombDisplay = constructKeyCombinationDisplay(pressedKeyCombination, true);
    isDuplicate = state.checkKeyCombinationDuplicate(pressedKeyCombination);
  }

  const duplicateMessageClasses = classnames('margin-bottom margin-left faint italic txt-md', {
    hidden: !isDuplicate,
  });
  return (
    <Modal
      ref={modalRef}
      className="shortcuts add-key-comb-modal"
    >
      <ModalHeader>Add Keyboard Shortcut</ModalHeader>
      <ModalBody noScroll>
        <div className="pad-left pad-right pad-top pad-bottom-sm">
          <div className="form-control form-control--outlined">
            <label>
              Press desired key combination and then press ENTER.
              <input onKeyDown={handleKeyDown} autoFocus type="text" className="key-comb" value={keyCombDisplay} readOnly />
            </label>
          </div>
        </div>
        <div className={duplicateMessageClasses}>Duplicate key combination</div>
      </ModalBody>
    </Modal>
  );
});
AddKeyCombinationModal.displayName = 'AddKeyCombinationModal';
