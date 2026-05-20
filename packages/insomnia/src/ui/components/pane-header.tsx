import type { ReactNode } from 'react';
import { Breadcrumb, Breadcrumbs } from 'react-aria-components';
import { NavLink } from 'react-router';

import { Icon } from '~/ui/components/icon';

export interface PaneBreadcrumb {
  id: string;
  label: string;
  to?: string;
  icon?: ReactNode;
}

interface PaneHeaderProps {
  breadcrumbs: PaneBreadcrumb[];
  rightSlot?: React.ReactNode;
  className?: string;
}

export const PaneHeader = ({ breadcrumbs, rightSlot, className = '' }: PaneHeaderProps) => {
  return (
    <div
      className={`flex h-(--line-height-sm) shrink-0 items-center gap-2 border-b border-solid border-(--hl-md) px-(--padding-sm) ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Breadcrumbs className="m-0 flex min-w-0 list-none items-center gap-1 text-sm font-bold">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <Breadcrumb
                key={crumb.id}
                data-testid={`workspace-breadcrumb-level-${index}`}
                className="flex min-w-0 items-center gap-1 text-(--color-font) outline-hidden select-none data-focused:outline-hidden"
              >
                {crumb.icon}
                {crumb.to && !isLast ? (
                  <NavLink
                    to={crumb.to}
                    className="truncate rounded-xs px-1 py-0.5 font-normal text-(--color-font) opacity-[0.7] ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                  >
                    {crumb.label}
                  </NavLink>
                ) : (
                  <span
                    className={`truncate px-1 py-0.5 font-normal opacity-[0.7] ${isLast ? 'text-(--color-font)' : 'text-(--hl)'}`}
                  >
                    {crumb.label}
                  </span>
                )}
                {!isLast && <Icon icon="chevron-right" className="mr-2 h-3 w-3 shrink-0 text-(--hl)" />}
              </Breadcrumb>
            );
          })}
        </Breadcrumbs>
      </div>
      {rightSlot ? (
        <div className="ml-auto flex h-full shrink-0 items-center gap-2 border-l border-(--hl-md) pl-2">
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
};
