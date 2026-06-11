import type { NumberFieldProps, ValidationResult } from 'react-aria-components';
import { Button, Group, Input as RaInput, Label, NumberField } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

interface CustomNumberFieldProps extends NumberFieldProps {
  label?: string;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const InputNumber = ({ label, min, max, errorMessage, className, ...props }: CustomNumberFieldProps) => {
  return (
    <NumberField className="flex flex-col" minValue={min} maxValue={max} {...props}>
      {label && <Label className="mb-2 pt-0">{label}</Label>}
      <Group className="flex h-[30px]">
        <RaInput
          className={({ isFocused, isFocusVisible, isInvalid }) =>
            twMerge(
              'h-[30px] w-full rounded-sm border border-solid bg-(--color-bg) p-2',
              isFocused && 'border-(--hl-lg)',
              isFocusVisible && 'ring-2 ring-(--hl-md) ring-offset-1',
              isInvalid && 'border-red-500',
              !isFocused && !isInvalid && 'border-(--hl-sm)',
              className,
            )
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
