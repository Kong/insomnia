// @flow
import * as React from 'react';
import { Button } from './button';
import type { ButtonProps } from './button';

// Taken from https://github.com/then/is-promise
function isPromise(obj) {
  return (
    !!obj &&
    (typeof obj === 'object' || typeof obj === 'function') &&
    typeof obj.then === 'function'
  );
}

type AsyncButtonProps = ButtonProps & {
  onClick?: (e: SyntheticEvent<HTMLButtonElement>) => Promise<any>,
  loadingNode?: React.Node,
};

export const AsyncButton = ({
  onClick,
  disabled,
  loadingNode,
  children,
  ...props
}: AsyncButtonProps) => {
  const [loading, setLoading] = React.useState(false);

  const asyncHandler = React.useCallback(
    async e => {
      const result = onClick(e);
      if (isPromise(result)) {
        try {
          setLoading(true);
          await result;
        } finally {
          setLoading(false);
        }
      }
    },
    [onClick],
  );

  return (
    <Button {...props} onClick={asyncHandler} disabled={loading || disabled}>
      {(loading && loadingNode) || children}
    </Button>
  );
};
