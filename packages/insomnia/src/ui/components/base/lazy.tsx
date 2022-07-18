import React, { PropsWithChildren, useLayoutEffect, useState } from 'react';

interface Props {
  delay?: number;
}

export const Lazy = ({ delay, children }: PropsWithChildren<Props>) => {
  const [show, setShow] = useState(false);

  useLayoutEffect(() => {
    if (typeof delay === 'number' && delay < 0) {
      // Show right away if negative delay passed
      setShow(true);
    } else {
      setTimeout(() => setShow(true), delay || 50);
    }
  }, [delay]);

  return show ? <>{children}</> : null;
};
