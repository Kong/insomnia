import { Tab, TabList, Tabs } from 'react-aria-components';
import { useNavigate } from 'react-router';
import { twMerge } from 'tailwind-merge';

type DocumentTabId = 'spec' | 'test';

interface Props {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  activeItemId: DocumentTabId;
  enableLegacyUnitTests: boolean;
  hasLegacyUnitTests: boolean;
  className?: string;
}

export const CollectionTab = ({
  organizationId,
  projectId,
  workspaceId,
  activeItemId,
  enableLegacyUnitTests,
  hasLegacyUnitTests,
  className,
}: Props) => {
  const navigate = useNavigate();
  const base = `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}`;

  // The setting forces the tab to show. Otherwise, only show it if the collection already has legacy tests.
  const showTestsTab = enableLegacyUnitTests || hasLegacyUnitTests;

  const items: { id: DocumentTabId; name: string; to: string }[] = [
    { id: 'spec', name: 'Spec', to: `${base}/debug` },
    ...(showTestsTab ? [{ id: 'test' as const, name: 'Tests', to: `${base}/test` }] : []),
  ];

  return (
    <Tabs
      selectedKey={activeItemId}
      onSelectionChange={key => {
        const item = items.find(item => item.id === key);
        item && navigate(item.to);
      }}
    >
      <TabList
        aria-label="API Collection Tabs"
        className={twMerge(
          'flex h-(--line-height-sm) w-full shrink-0 items-center border-b border-solid border-b-(--hl-md) bg-(--color-bg)',
          className,
        )}
      >
        {items.map(item => (
          <Tab
            key={item.id}
            id={item.id}
            className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm) data-focus-visible:ring-2 data-focus-visible:ring-(--hl-md) data-focus-visible:ring-inset"
            data-testid={`api-collection-tab-${item.name.toLowerCase()}`}
          >
            {item.name}
          </Tab>
        ))}
      </TabList>
    </Tabs>
  );
};
