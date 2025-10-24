import cn from 'classnames';
import type { SwitchProps } from 'react-aria-components';
import { Switch as RaSwitch } from 'react-aria-components';

interface CustomSwitchProps extends Omit<SwitchProps, 'children'> {
  children?: React.ReactNode;
}

export const Switch = ({ children, ...props }: CustomSwitchProps) => {
  return (
    <RaSwitch className="flex h-full cursor-pointer items-center p-0" {...props}>
      {({ isSelected, isDisabled }) => {
        return (
          <div
            className={cn(
              "h-4.5 w-[30px] rounded-full border-[1px] border-solid border-[--hl] bg-[--color-bg] transition-all duration-200 before:m-0.5 before:block before:h-3.5 before:w-3.5 before:rounded-full before:transition-all before:duration-200 before:content-['']",
              {
                'bg-[--color-surprise] before:translate-x-[100%] before:bg-[--color-bg]': isSelected,
                'before:bg-[--color-surprise]': !isSelected,
                'cursor-not-allowed border-[--hl] before:bg-[--hl]': isDisabled,
              },
            )}
          />
        );
      }}
    </RaSwitch>
  );
};
