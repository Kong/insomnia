import type { FC } from 'react';

export interface BadgeProps {
  color: string;
  icon?: React.ReactNode;
  label: string;
}

export const Badge: FC<BadgeProps> = ({ color, icon, label }) => {
  return (
    <span
      style={{
        borderWidth: '1.5px',
        borderRadius: '2.5px',
        borderStyle: 'solid',
        marginRight: '6.5px',
        padding: '1px 3.5px',
        fontWeight: '500',
        verticalAlign: 'middle',
        position: 'relative',
        top: '-1px',
        color: `rgb(var(--color-${color}-rgb))`,
        borderColor: `rgb(var(--color-${color}-rgb))`,
      }}
    >
      {icon && icon}
      <span className="ml-1 align-top">{label}</span>
    </span>
  );
};
