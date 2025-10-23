import type { FC } from 'react';

export interface BadgeProps {
  color: string;
  icon?: React.ReactNode;
  label: string;
  textSize?: string;
}

export const Badge: FC<BadgeProps> = ({ color, icon, label, textSize = '0.8rem' }) => {
  return (
    <span
      className={`mr-0.5 rounded-[2.5px] border-2 border-solid px-[0.25rem] py-[0.1rem] text-[${textSize}] text-[--color-${color}] border--[rgb(--color-${color}-rgb)]`}
    >
      {icon && icon}
      <span className="ml-1">{label}</span>
    </span>
  );
};
