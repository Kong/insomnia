import classnames from 'classnames';
import { Link } from 'react-router';

type DocumentTabId = 'spec' | 'test';

interface Props {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  activeItemId: DocumentTabId;
  enableLegacyUnitTests: boolean;
  className?: string;
}

export const DocumentTab = ({
  organizationId,
  projectId,
  workspaceId,
  activeItemId,
  enableLegacyUnitTests,
  className,
}: Props) => {
  const base = `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}`;

  const items: { id: DocumentTabId; name: string; to: string }[] = [
    { id: 'spec', name: 'Spec', to: `${base}/debug` },
    ...(enableLegacyUnitTests ? [{ id: 'test' as const, name: 'Tests', to: `${base}/test` }] : []),
  ];

  return (
    <nav className={`flex h-10 w-full items-center ${className} justify-around px-1`}>
      {items.map(item => (
        <Link
          key={item.id}
          to={item.to}
          className={classnames('rounded-full px-2 text-center', {
            'bg-(--color-surprise) text-(--color-font-surprise)': item.id === activeItemId,
          })}
          data-testid={`workspace-${item.id}`}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  );
};
