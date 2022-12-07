import { isMac } from '@insomnia/common/constants';
import { constructKeyCombinationDisplay, getPlatformKeyCombinations } from '@insomnia/common/hotkeys';
import { KeyCombination, PlatformKeyCombinations } from '@insomnia/common/settings';
import classnames from 'classnames';
import React, { FC, memo } from 'react';

interface Props {
  /** One of these two must be given. If both is given, keyCombination will be used. */
  keyCombination?: KeyCombination;
  keyBindings?: PlatformKeyCombinations;
  className?: string;
  /** Show fallback message if keyCombination is not given, but keyBindings has no key combinations. */
  useFallbackMessage?: boolean;
}

export const Hotkey: FC<Props> = memo(({ keyCombination, keyBindings, className, useFallbackMessage }) => {
  if (keyCombination == null && keyBindings == null) {
    console.error('Hotkey needs one of keyCombination or keyBindings!');
    return null;
  }

  let keyComb: KeyCombination | null = null;

  if (keyCombination != null) {
    keyComb = keyCombination;
  } else if (keyBindings != null) {
    const keyCombs = getPlatformKeyCombinations(keyBindings);

    // Only take the first key combination if there is a mapping.
    if (keyCombs.length > 0) {
      keyComb = keyCombs[0];
    }
  }

  let display = '';

  if (keyComb != null) {
    display = constructKeyCombinationDisplay(keyComb, false);
  }

  const isFallback = display.length === 0 && useFallbackMessage;

  if (isFallback) {
    display = 'Not defined';
  }

  const classes = {
    'font-normal': isMac(),
    italic: isFallback,
  };

  return (
    <span
      className={classnames(className, classes)}
      style={{ verticalAlign: 'middle' }}
    >
      {display}
    </span>
  );
});

Hotkey.displayName = 'Hotkey';
