import type { TextFieldProps, TextProps, ValidationResult } from 'react-aria-components';
import { FieldError, Input as RaInput, Label, Text, TextField as RaTextField } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

interface CustomInputFieldProps extends TextFieldProps {
  label?: string;
  placeholder?: string;
  description?: string;
  className?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export function Description(props: TextProps) {
  return <Text {...props} slot="description" className={twMerge('text-xs', props.className)} />;
}

export const Input = ({ label, errorMessage, className, description, ...props }: CustomInputFieldProps) => {
  return (
    <RaTextField className={twMerge('flex flex-col text-(--color-font)', className)} {...props}>
      {label && <Label className="mb-2 pt-0 text-sm">{label}</Label>}
      {description && <Description className="mb-1.5">{description}</Description>}
      <RaInput
        className={({ isFocused, isFocusVisible, isInvalid }) =>
          twMerge(
            'h-[30px] w-full rounded-sm border border-solid bg-(--color-bg) p-2',
            isFocused && 'border-(--hl-lg)',
            isFocusVisible && 'ring-2 ring-(--hl-md) ring-offset-1',
            isInvalid && 'border-red-500',
            !isFocused && !isInvalid && 'border-(--hl-sm)',
          )
        }
      />
      <FieldError className="text-xs text-(--color-danger)" />
    </RaTextField>
  );
};
