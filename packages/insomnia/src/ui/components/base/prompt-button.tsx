import React, {
  FunctionComponent,
  MouseEvent,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

type PromptStateEnum = 'default' | 'ask' | 'done';

interface Props<T> {
  className?: string;
  disabled?: boolean;
  confirmMessage?: string;
  doneMessage?: string;
  tabIndex?: number;
  title?: string;
  fullWidth?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>, value?: T) => void;
}

export const PromptButton = <T, >({
  onClick,
  disabled,
  confirmMessage = 'Click to confirm',
  doneMessage = 'Done',
  tabIndex,
  title,
  className,
  fullWidth = false,
  children,
}: PropsWithChildren<Props<T>>) => {
  // Create flag to store the state value.
  const [state, setState] = useState<PromptStateEnum>('default');

  // Timeout instancies
  const doneTimeout = useRef<NodeJS.Timeout | null>(null);
  const triggerTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      triggerTimeout.current && clearTimeout(triggerTimeout.current);
      doneTimeout.current && clearTimeout(doneTimeout.current);
    };
  }, []);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (state === 'default') {
      // Prevent events (ex. won't close dropdown if it's in one)
      event.preventDefault();
      event.stopPropagation();
      // Toggle the confirmation notice
      setState('ask');
      // Set a timeout to hide the confirmation
      // using global.setTimeout to force use of the Node timeout rather than DOM timeout
      triggerTimeout.current = global.setTimeout(() => {
        setState('default');
      }, 2000);
    }
    if (state === 'ask') {
      if (triggerTimeout.current !== null) {
        // Clear existing timeouts
        clearTimeout(triggerTimeout.current);
      }
      // Fire the click handler
      onClick?.(event);
      // Set the state to done (but delay a bit to not alarm user)
      // using global.setTimeout to force use of the Node timeout rather than DOM timeout
      doneTimeout.current = global.setTimeout(() => {
        setState('done');
      }, 100);
      // Set a timeout to hide the confirmation
      // using global.setTimeout to force use of the Node timeout rather than DOM timeout
      triggerTimeout.current = global.setTimeout(() => {
        setState('default');
      }, 2000);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      tabIndex={tabIndex}
      title={title}
      className={className}
      style={{
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <PromptMessage
        promptState={state}
        confirmMessage={confirmMessage}
        doneMessage={doneMessage}
      >
        {children}
      </PromptMessage>
    </button>
  );
};

interface PromptMessageProps {
  promptState: PromptStateEnum;
  confirmMessage?: string;
  doneMessage?: string;
  children: ReactNode;
}
const PromptMessage: FunctionComponent<PromptMessageProps> = ({ promptState, confirmMessage, doneMessage, children }) => {
  if (promptState === 'ask') {
    return (
      <span className='warning' title='Click again to confirm'>
        <i className='fa fa-exclamation-circle' />
        {confirmMessage && (
          <span className='space-left'>{confirmMessage}</span>
        )}
      </span>
    );
  }

  if (promptState === 'done' && doneMessage) {
    return <span className='space-left'>{doneMessage}</span>;
  }

  return <>{children}</>;
};
