import React, { ReactNode, useCallback, useState } from 'react';

import type { ButtonProps } from './button';
import { Button } from './button';

// Taken from https://github.com/then/is-promise
function isPromise(obj: unknown) {
  return (
    !!obj &&
    (typeof obj === 'object' || typeof obj === 'function') &&
    // @ts-expect-error -- not updating because this came direclty from the npm
    typeof obj.then === 'function'
  );
}

export interface AsyncButtonProps<T> extends ButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => Promise<T>;
  loadingNode?: ReactNode;
}

export const AsyncButton = <T extends unknown>({
  onClick,
  disabled,
  loadingNode,
  children,
  ...props
}: AsyncButtonProps<T>) => {
  const [loading, setLoading] = useState(false);
  const asyncHandler = useCallback(async event => {
    const result = onClick(event);

    if (isPromise(result)) {
      try {
        setLoading(true);
        await result;
      } finally {
        setLoading(false);
      }
    }
  }, [onClick]);

  return (
    <Button
      {...props}
      onClick={asyncHandler}
      disabled={loading || disabled}
    >
      {(loading && loadingNode) || children}
    </Button>
  );
};
