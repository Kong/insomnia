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
  sortOrder: SortOrder;
  onToggle: (workspaceId: string) => void;
  onSortOrderChange: (newSortOrder: SortOrder) => void;
}

export const WorkspaceNode = ({ item, sortOrder, onToggle, onSortOrderChange }: WorkspaceNodeProps) => {
  const { doc, collapsed, project, organizationId } = item;
  const { name: workspaceName, _id: workspaceId, scope: workspaceScope } = doc;
  const isCollection = workspaceScope === 'collection';

  return (
    <div
      className={`${ROW_CLASS} group`}
      style={{ paddingLeft: '2em' }}
      data-testid={`workspace-node-${workspaceName}`}
      data-project={project.name}
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
      <div className="shrink-0">
        <SidebarWorkspaceDropdown
          workspace={doc}
          project={project}
          sortOrder={sortOrder}
          organizationId={organizationId}
          onSortOrderChange={onSortOrderChange}
        />
      </div>
    </div>
  );
};
