import React, { FC, HTMLAttributes, useEffect, useRef } from 'react';

interface Props extends HTMLAttributes<HTMLInputElement> {
  indeterminate: boolean;
  checked: boolean;
}

export const IndeterminateCheckbox: FC<Props> = ({ checked, indeterminate, ...otherProps }) => {
  const checkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkRef.current) {
      checkRef.current.checked = checked;
      checkRef.current.indeterminate = indeterminate;
    }
  }, [checked, indeterminate]);

  return (
    <input
      type="checkbox"
      ref={checkRef}
      {...otherProps}
    />
  );
};
