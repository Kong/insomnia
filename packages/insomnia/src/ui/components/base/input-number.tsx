import cn from 'classnames';
import type { NumberFieldProps, ValidationResult } from 'react-aria-components';
import { Button, Group, Input as RaInput, Label, NumberField } from 'react-aria-components';

interface CustomNumberFieldProps extends NumberFieldProps {
  label?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const InputNumber = ({ label, min, max, errorMessage, ...props }: CustomNumberFieldProps) => {
  return (
    <NumberField className="flex flex-col" minValue={min} maxValue={max} {...props}>
      {label && <Label className="mb-2 pt-0">{label}</Label>}
      <Group className="flex h-[30px]">
        <RaInput
          className={({ isFocused, isFocusVisible, isInvalid }) =>
            cn('h-[30px] w-full rounded-sm border border-solid bg-[--color-bg] p-2', {
              'border-[--hl-lg]': isFocused,
              'ring-2 ring-[--hl-md] ring-offset-1': isFocusVisible,
              'border-red-500': isInvalid,
              'border-[--hl-sm]': !isFocused && !isInvalid,
            })
          }
        />
        <div className="flex flex-col">
          <Button className="flex h-[50%] w-6 items-center justify-center" slot="increment">
            +
          </Button>
          <Button className="flex h-[50%] w-6 items-center justify-center" slot="decrement">
            -
          </Button>
        </div>
      </Group>
    </NumberField>
  );
};
