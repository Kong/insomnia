import { type Ref, useState } from 'react';
import { Button } from 'react-aria-components';

import type { SortOrder } from '~/common/constants';
import { scopeToBgColorMap, scopeToIconMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { SidebarWorkspaceDropdown } from '~/ui/components/dropdowns/sidebar-workspace-dropdown';

import { Icon } from '../../icon';
import {
  ACTIVE_BORDER_CLASS,
  GUIDE_LINE_CSS,
  ICON_CLASS,
  ROW_CLASS,
  TOGGLE_BTN_CLASS,
} from './project-navigation-sidebar-utils';
import { type WorkspaceFlatItem } from './types';

interface WorkspaceNodeProps {
  item: WorkspaceFlatItem;
  onToggle: (workspaceId: string) => void;

  sortOrder: SortOrder;
  onSortOrderChange: (newSortOrder: SortOrder) => void;
  highlighted?: boolean;
  nodeRef?: Ref<HTMLDivElement> | ((node: HTMLDivElement | null) => void);
}

export const WorkspaceNode = ({
  item,
  sortOrder,
  onToggle,
  onSortOrderChange,
  highlighted,
  nodeRef,
}: WorkspaceNodeProps) => {
  const { doc, collapsed, project, organizationId, hasUncommittedChanges, hasUnpushedChanges } = item;
  const { name: workspaceName, _id: workspaceId, scope: workspaceScope } = doc;
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const isCollection = workspaceScope === 'collection';

  return (
    <div
      ref={nodeRef}
      className={`${ROW_CLASS} group ${highlighted ? 'rounded-xs ring-2 ring-(--color-surprise) ring-inset' : ''}`}
      style={{ paddingLeft: '2em' }}
      data-testid={`workspace-node-${workspaceName}`}
      data-project={project.name}
      onContextMenu={e => {
        e.preventDefault();
        setIsContextMenuOpen(true);
      }}
    >
      <span className={ACTIVE_BORDER_CLASS} />
      <span className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm)`} style={{ left: '1.5em' }} />
      <Button slot="drag" className="hidden" />
      <Button
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${workspaceName}`}
        onPress={() => isCollection && onToggle(workspaceId)}
        className={TOGGLE_BTN_CLASS}
      >
        {isCollection ? <Icon icon={collapsed ? 'chevron-right' : 'chevron-down'} className={ICON_CLASS} /> : null}
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left transition-colors">
        <div
          className={`${scopeToBgColorMap[workspaceScope]} ${scopeToTextColorMap[workspaceScope]} flex h-5 w-5 items-center justify-center rounded-sm px-2`}
        >
          <Icon icon={scopeToIconMap[workspaceScope]} className={ICON_CLASS} />
        </div>

        <span className="min-w-0 flex-1 truncate text-base">{workspaceName}</span>
      </div>
      {(hasUncommittedChanges || hasUnpushedChanges) && (
        <div className="flex aspect-square h-6 shrink-0 items-center justify-center">
          <Icon icon="circle" className="h-2 w-2" color="var(--color-warning)" />
        </div>
      )}
      <div className="shrink-0">
        <SidebarWorkspaceDropdown
          workspace={doc}
          project={project}
          sortOrder={sortOrder}
          organizationId={organizationId}
          onSortOrderChange={onSortOrderChange}
          isOpen={isContextMenuOpen}
          onOpenChange={setIsContextMenuOpen}
        />
      </div>
    </div>
  );
};
