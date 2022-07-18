import React, { MouseEvent, PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';

import { Button } from './button';

enum States {
  'default',
  'ask',
  'done',
}

interface Props<T> {
  value?: T;
  className?: string;
  addIcon?: boolean;
  doneIcon?: boolean;
  disabled?: boolean;
  confirmMessage?: string;
  doneMessage?: string;
  tabIndex?: number;
  title?: string;
  doneAfterTimeout?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>, value?: T) => void;
}

export const PromptButton = <T, >({
  onClick,
  addIcon,
  doneIcon,
  disabled,
  confirmMessage = 'Click to confirm',
  doneMessage = 'Done',
  value,
  tabIndex,
  title,
  className,
  doneAfterTimeout = false,
  children,
}: PropsWithChildren<Props<T>>) => {
  // Create flag to store the state value.
  const [state, setState] = useState<States>(States.default);

  // Timeout instancies
  const doneTimeout = useRef<NodeJS.Timeout | null>(null);
  const triggerTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    () => {
      triggerTimeout.current && clearTimeout(triggerTimeout.current);
      doneTimeout.current && clearTimeout(doneTimeout.current);
    };
  }, []);

  const handleConfirm = (event: MouseEvent<HTMLButtonElement>) => {
    if (triggerTimeout.current !== null) {
      // Clear existing timeouts
      clearTimeout(triggerTimeout.current);
    }

    // Fire the click handler
    !doneAfterTimeout && onClick?.(event, value);

    // Set the state to done (but delay a bit to not alarm user)
    // using global.setTimeout to force use of the Node timeout rather than DOM timeout
    doneTimeout.current = global.setTimeout(() => {
      setState(States.done);
    }, 100);
    // Set a timeout to hide the confirmation
    // using global.setTimeout to force use of the Node timeout rather than DOM timeout
    triggerTimeout.current = global.setTimeout(() => {
      setState(States.default);

      // Fire the click handler
      doneAfterTimeout && onClick?.(event, value);
    }, 2000);
  };

  const handleAsk = (event: MouseEvent<HTMLButtonElement>) => {
    // Prevent events (ex. won't close dropdown if it's in one)
    event.preventDefault();
    event.stopPropagation();

    // Toggle the confirmation notice
    setState(States.ask);

    // Set a timeout to hide the confirmation
    // using global.setTimeout to force use of the Node timeout rather than DOM timeout
    triggerTimeout.current = global.setTimeout(() => {
      setState(States.default);
    }, 2000);
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (state === States.ask) {
      handleConfirm(event);
    } else if (state === States.default) {
      handleAsk(event);
    }
  };

  const getChildren = useCallback(() => {
    // In case the state is ask
    if (state === States.ask) {
      return (
        <span className="warning" title="Click again to confirm">
          {addIcon && <i className="fa fa-exclamation-circle" />}
          {confirmMessage && <span className="space-left">{confirmMessage}</span>}
        </span>
      );
    }

    // In case the state is done.
    if (state === States.done) {
      return (
        <span className="success">
          {doneIcon && <i className="fa fa-check" />}
          {doneMessage && <span className="space-left">{doneMessage}</span>}
        </span>
      );
    }

    // Otherwise return the children.
    return children;

  }, [state, addIcon, doneIcon, confirmMessage, doneMessage, children]);

  return (
    <Button onClick={handleClick} disabled={disabled} tabIndex={tabIndex} title={title} className={className}>
      {getChildren()}
    </Button>
  );
};
