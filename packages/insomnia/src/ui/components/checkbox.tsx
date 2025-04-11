import React from 'react';
import { Checkbox as RACheckbox, type CheckboxProps } from 'react-aria-components';

type Props = {
  children: React.ReactNode;
} & CheckboxProps;

export const Checkbox = ({ children, ...props }: Props) => {
  return (
    <RACheckbox
      {...props}
      aria-label="Checkbox"
      className="group p-0 pl-1 flex items-center h-full gap-2"
    >
      <div className="size-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
        <svg
          fill="none"
          viewBox="0 0 14 14"
          className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-[--color-font] group-has-[:disabled]:stroke-gray-950/25"
        >
          <path
            d="M3 8L6 11L11 3.5"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-0 group-data-[selected]:opacity-100 group-data-[indeterminate]:opacity-0"
          />
          <path
            d="M3 7H11"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-0 group-has-[:indeterminate]:opacity-100"
          />
        </svg>
      </div>
      {children}
    </RACheckbox>
  );
};
