import classnames from 'classnames';
import { NavLink } from 'react-router';

interface Props {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  className?: string;
}

export const DocumentTab = ({ organizationId, projectId, workspaceId, className }: Props) => {
  return (
    <nav className={classnames('flex h-7 w-auto items-center justify-center gap-2 rounded-xs px-1', className)}>
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
              'bg-(--color-surprise) text-(--color-font-surprise)': isActive,
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
