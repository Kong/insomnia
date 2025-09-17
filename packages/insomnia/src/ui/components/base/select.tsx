import classnames from 'classnames';
import React from 'react';
import {
  Button,
  ListBox,
  ListBoxItem,
  Popover,
  Select as RaSelect,
  type SelectProps as RaSelectProps,
  SelectValue,
} from 'react-aria-components';

import { Icon } from '../icon';

interface SelectProps {
  value: string;
  onChange: (value: string | number) => void;
  className?: string;
  options: { label: string; value: string }[];
}

export const Select = ({ value, onChange, className, options, ...rest }: SelectProps & RaSelectProps) => {
  return (
    <RaSelect selectedKey={value} onSelectionChange={onChange} {...rest} className={classnames('', className)}>
      <Button className="flex w-full gap-2 rounded border border-solid border-[--hl-sm] px-2 py-1">
        <SelectValue className="flex-1" />
        <span aria-hidden="true">
          <Icon icon="chevron-down" />
        </span>
      </Button>
      <Popover className="w-[--trigger-width]">
        <ListBox className="rounded border border-solid border-[--hl-sm] bg-[--color-bg]">
          {options?.map(option => (
            <ListBoxItem
              className={({ isHovered, isPressed, isFocused }) =>
                classNames('flex min-h-[32px] cursor-pointer items-center px-2', {
                  'bg-[--hl-xs]': isHovered || isPressed || isFocused,
                })
              }
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
    </RaSelect>
  );
};

<select />;
