import React from 'react';
import {
  Button,
  type Key,
  ListBox,
  ListBoxItem,
  Popover,
  Select as RaSelect,
  type SelectProps as RaSelectProps,
  SelectValue,
} from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

import { Icon } from '../icon';

interface CustomSelectProps<T extends object> extends Omit<RaSelectProps<T>, 'children'> {
  label?: string;
  value?: Key | null;
  onChange?: RaSelectProps<T>['onSelectionChange'];
  className?: string;
  options: { label: string; value: string }[];
}
// current react-aria only supports single selection
export const Select = <T extends object>({
  value,
  className,
  onChange,
  options,
  label,
  ...rest
}: CustomSelectProps<T>) => {
  return (
    <RaSelect placeholder="Select an item" selectedKey={value} onSelectionChange={onChange} {...rest}>
      {({ isInvalid, isDisabled }) => (
        <>
          <Button
            className={twMerge(
              'flex w-full gap-2 rounded-sm border border-solid px-2 py-1 text-(--color-font)',
              isDisabled && 'border-(--hl-xs)',
              isInvalid && 'border-(--color-danger)',
              !isDisabled && !isInvalid && 'border-(--hl-sm)',
              className,
            )}
          >
            <SelectValue className="flex-1" />
            <span aria-hidden="true">
              <Icon icon="chevron-down" />
            </span>
          </Button>
          <Popover className="min-w-(--trigger-width)">
            <ListBox className="rounded-sm border border-solid border-(--hl-sm) bg-(--color-bg)">
              {options?.map(option => (
                <ListBoxItem
                  className={({ isHovered, isPressed, isFocused }) =>
                    twMerge(
                      'flex min-h-8 cursor-pointer items-center px-2 text-(--color-font)',
                      (isHovered || isPressed || isFocused) && 'bg-(--hl-xs)',
                    )
                  }
                  id={option.value}
                  key={option.value}
                >
                  {({ isSelected }) => (
                    <>
                      <span className="flex w-5 items-center justify-center">{isSelected && '✓'}</span>
                      <span className="ml-1">{option.label}</span>
                    </>
                  )}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </>
      )}
    </RaSelect>
  );
};
