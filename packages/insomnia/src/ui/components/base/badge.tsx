import type { FC } from 'react';

import { type IconId, SvgIcon, type ThemeEnum } from '~/ui/components/svg-icon';

export interface BadgeProps {
  color: keyof typeof ThemeEnum;
  icon?: IconId;
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
      {icon && <SvgIcon icon={icon} />}
      <span className="ml-1 align-top">{label}</span>
    </span>
  );
};
