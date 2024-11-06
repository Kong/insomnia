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
    <nav className={`flex w-full h-[40px] items-center ${className} px-1 justify-around`}>
      {[
        { id: 'spec', name: 'Spec' },
        { id: 'debug', name: 'Collection' },
        { id: 'test', name: 'Tests' },
      ].map(item => (
        <NavLink
          key={item.id}
          to={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${item.id}`}
          className={({ isActive, isPending }) =>
            `${isActive
              ? 'text-[--color-font] bg-[--color-surprise]'
              : ''
            } ${isPending ? 'animate-pulse' : ''} text-center rounded-full px-2`
          }
          data-testid={`workspace-${item.id}`}
        >
          {item.name}
        </NavLink>
      ))}
    </nav>
  );
};
