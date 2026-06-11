import React, { memo, type ReactNode } from 'react';
import {
  Checkbox as RaCheckbox,
  CheckboxGroup as RaCheckboxGroup,
  type CheckboxGroupProps,
  type CheckboxProps,
} from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

import { Icon } from '../icon';

export const Checkbox = memo(
  ({
    isSelected,
    isIndeterminate,
    onChange,
    className,
    children,
    ...rest
  }: Omit<CheckboxProps, 'children' | 'className'> & {
    children: ReactNode;
    className?: string;
  }) => {
    return (
      <RaCheckbox
        isSelected={isSelected}
        onChange={onChange}
        className={twMerge('group flex items-center gap-2 p-0', className)}
        {...rest}
      >
        <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-(--hl-sm) text-xs transition-colors group-focus:ring-2 group-data-selected:bg-(--hl-xs)">
          <Icon
            icon={isIndeterminate ? 'minus' : 'check'}
            className="h-3 w-3 opacity-0 group-data-indeterminate:text-(--color-success) group-data-indeterminate:opacity-100 group-data-selected:text-(--color-success) group-data-selected:opacity-100"
          />
        </div>
        {children}
      </RaCheckbox>
    );
  },
);

interface InsomniaCheckboxGroupProps extends CheckboxGroupProps {
  options: { label: string; value: string }[];
}
export const CheckboxGroup = ({ options, ...rest }: InsomniaCheckboxGroupProps) => {
  return (
    <RaCheckboxGroup {...rest}>
      {options.map(option => (
        <Checkbox key={option.value} value={option.value} className="text-sm text-(--color-font)">
          {option.label}
        </Checkbox>
      ))}
    </RaCheckboxGroup>
  );
};
