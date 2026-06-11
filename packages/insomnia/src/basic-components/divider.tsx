import { twMerge } from 'tailwind-merge';

interface DividerProps {
  className?: string;
}

export const Divider = ({ className }: DividerProps) => {
  return <div className={twMerge(`border-t border-(--hl-md) ${className}`)} />;
};
