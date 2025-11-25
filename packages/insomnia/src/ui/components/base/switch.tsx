import type { SwitchProps } from 'react-aria-components';
import { Switch as RaSwitch } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

interface CustomSwitchProps extends Omit<SwitchProps, 'children' | 'className'> {
  children?: React.ReactNode;
  className?: string;
}

export const Switch = ({ children, className, ...props }: CustomSwitchProps) => {
  return (
    <RaSwitch className="flex h-full cursor-pointer items-center p-0" {...props}>
      {({ isSelected, isDisabled }) => {
        return (
          <div
            className={twMerge(
              "h-4.5 w-[30px] rounded-full border border-solid border-(--hl) bg-(--color-bg) transition-all duration-200 before:m-0.5 before:block before:h-3.5 before:w-3.5 before:rounded-full before:transition-all before:duration-200 before:content-['']",
              isSelected && 'bg-(--color-surprise) before:translate-x-full before:bg-(--color-bg)',
              !isSelected && 'before:bg-(--color-surprise)',
              isDisabled && 'cursor-not-allowed border-(--hl) before:bg-(--hl)',
              className,
            )}
          />
        );
      }}
    </RaSwitch>
  );
};
