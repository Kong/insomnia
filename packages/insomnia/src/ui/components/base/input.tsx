import type { TextFieldProps, TextProps, ValidationResult } from 'react-aria-components';
import { FieldError, Input as RaInput, Label, Text, TextField as RaTextField } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

interface CustomInputFieldProps extends TextFieldProps {
  label?: string;
  placeholder?: string;
  description?: string;
  className?: string;
  prefix?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export function Description(props: TextProps) {
  return <Text {...props} slot="description" className={twMerge('text-xs', props.className)} />;
}

export const Input = ({ label, errorMessage, className, description, prefix, ...props }: CustomInputFieldProps) => {
  return (
    <RaTextField className={twMerge('flex flex-col text-(--color-font)', className)} {...props}>
      {({ isInvalid }) => (
        <>
          {label && <Label className="mb-2 pt-0 text-sm">{label}</Label>}
          {description && <Description className="mb-1.5">{description}</Description>}

          <div
            className={twMerge(
              'flex h-[30px] w-full items-center overflow-hidden rounded-sm border border-solid bg-(--color-bg)',
              'border-(--hl-sm)',
              'has-focus:border-(--hl-lg)',
              // 'has-focus-visible:ring-2 has-focus-visible:ring-(--hl-md) has-focus-visible:ring-offset-1',
              isInvalid && 'border-(--color-danger)',
            )}
          >
            {prefix && (
              <span className="flex h-full items-center border-r border-(--hl-sm) bg-(--hl-xs) px-2 text-sm text-(--hl)">
                {prefix}
              </span>
            )}
            <RaInput className={twMerge('h-full w-full rounded-sm p-2')} />
          </div>

          <FieldError className="text-xs text-(--color-danger)">{errorMessage}</FieldError>
        </>
      )}
    </RaTextField>
  );
};
