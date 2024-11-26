import React, {
  type FunctionComponent,
  type MouseEvent,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

type PromptStateEnum = 'default' | 'ask' | 'loading' | 'done';

interface Props<T> {
  className?: string;
  disabled?: boolean;
  confirmMessage?: string;
  doneMessage?: string;
  loadingMessage?: string;
  tabIndex?: number;
  title?: string;
  fullWidth?: boolean;
  ariaLabel?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>, value?: T) => void;
  referToOnClickReturnValue?: boolean;
}

export const PromptButton = <T, >({
  onClick,
  disabled,
  confirmMessage = 'Click to confirm',
  doneMessage = 'Done',
  loadingMessage = 'Loading',
  tabIndex,
  title,
  className,
  fullWidth = false,
  ariaLabel,
  children,
  referToOnClickReturnValue = false,
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
      const retVal: any = onClick?.(event);
      if (!referToOnClickReturnValue) {
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
      } else {
        if (retVal instanceof Promise) {
          setState('loading');
          retVal.then(() => {
            setState('done');
          }).finally(() => {
            triggerTimeout.current = global.setTimeout(() => {
              setState('default');
            }, 1000);
          });
        } else {
          throw new Error('onClick must return a Promise when referToOnClickReturnValue is true');
        }
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      tabIndex={tabIndex}
      title={title}
      className={className}
      aria-label={ariaLabel}
      style={{
        width: fullWidth ? '100%' : 'auto',
      }}
    >
      <PromptMessage
        promptState={state}
        confirmMessage={confirmMessage}
        doneMessage={doneMessage}
        loadingMessage={loadingMessage}
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
  loadingMessage: string;
  children: ReactNode;
}
const PromptMessage: FunctionComponent<PromptMessageProps> = ({ promptState, confirmMessage, doneMessage, loadingMessage, children }) => {

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

  if (promptState === 'loading') {
    return (
      <span className='warning' title='loading'>
        <i className='fa fa-spinner animate-spin' />
        <span className='space-left'>{loadingMessage}</span>
      </span>
    );
  }

  if (promptState === 'done' && doneMessage) {
    return <span className='space-left'>{doneMessage}</span>;
  }

  return <>{children}</>;
};
