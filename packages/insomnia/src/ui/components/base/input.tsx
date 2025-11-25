import type { TextFieldProps, ValidationResult } from 'react-aria-components';
import { Input as RaInput, Label, TextField as RaTextField } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

interface CustomInputFieldProps extends TextFieldProps {
  label?: string;
  placeholder?: string;
  className?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const Input = ({ label, errorMessage, className, ...props }: CustomInputFieldProps) => {
  return (
    <RaTextField className="flex flex-col text-(--color-font)" {...props}>
      {label && <Label className="mb-2 pt-0">{label}</Label>}
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
    </RaTextField>
  );
};
