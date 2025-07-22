import classnames from 'classnames';
import React, { memo, type ReactNode } from 'react';
import { Checkbox as RaCheckbox, type CheckboxProps } from 'react-aria-components';

import { Icon } from '../icon';

export const Checkbox = memo(
  ({
    isSelected,
    isIndeterminate,
    onChange,
    className,
    children,
    ...rest
  }: Omit<CheckboxProps, 'children'> & {
    children: ReactNode;
  }) => {
    return (
      <RaCheckbox isSelected={isSelected} onChange={onChange} className={classnames('gap-2', className)} {...rest}>
        <div className="flex h-4 w-4 items-center justify-center rounded ring-1 ring-[--hl-sm] transition-colors group-focus:ring-2 group-data-[selected]:bg-[--hl-xs]">
          <Icon
            icon={isIndeterminate ? 'minus' : 'check'}
            className="h-3 w-3 opacity-0 group-data-[indeterminate]:text-[--color-success] group-data-[selected]:text-[--color-success] group-data-[indeterminate]:opacity-100 group-data-[selected]:opacity-100"
          />
        </div>
        {children}
      </RaCheckbox>
    );
  },
);
