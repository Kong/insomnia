import cn from 'classnames';
import type { TextFieldProps, ValidationResult } from 'react-aria-components';
import { Input as RaInput, Label, Text, TextField as RaTextField } from 'react-aria-components';

interface CustomInputFieldProps extends TextFieldProps {
  label?: string;
  placeholder?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const Input = ({ label, errorMessage, ...props }: CustomInputFieldProps) => {
  return (
    <RaTextField className="flex flex-col text-[--color-font]" {...props}>
      {label && <Label className="mb-2 pt-0">{label}</Label>}
      <RaInput
        className={({ isHovered, isFocused, isFocusVisible, isInvalid }) =>
          cn('h-[30px] w-full rounded-sm border border-solid border-[--hl] bg-[--color-bg] p-2', {
            'border-[--hl-md]': isHovered,
            'border-[--hl-lg]': isFocused,
            'ring-2 ring-[--hl-md] ring-offset-1': isFocusVisible,
            'border-red-500': isInvalid,
          })
        }
      />
    </RaTextField>
  );
};
