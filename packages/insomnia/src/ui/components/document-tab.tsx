import classnames from 'classnames';
import React from 'react';
import { NavLink } from 'react-router-dom';

interface Props {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  className?: string;
}

export const DocumentTab = ({ organizationId, projectId, workspaceId, className }: Props) => {
  return (
    <nav className={`flex h-[40px] w-full items-center ${className} justify-around px-1`}>
      {[
        { id: 'spec', name: 'Spec' },
        { id: 'debug', name: 'Collection' },
        { id: 'test', name: 'Tests' },
      ].map(item => (
        <NavLink
          key={item.id}
          to={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${item.id}`}
          className={({ isActive, isPending }) =>
            classnames('rounded-full px-2 text-center', {
              'bg-[--color-surprise] text-[--color-font-surprise]': isActive,
              'animate-pulse': isPending,
            })
          }
          data-testid={`workspace-${item.id}`}
        >
          {item.name}
        </NavLink>
      ))}
    </nav>
  );
};
