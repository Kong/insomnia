import { Button } from 'react-aria-components';

import { scopeToIconMap } from '~/common/get-workspace-label';

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
}

export const WorkspaceNode = ({ item, onToggle }: WorkspaceNodeProps) => {
  const { doc, collapsed } = item;
  const { name: workspaceName, _id: workspaceId, scope: workspaceScope } = doc;

  return (
    <div className={`${ROW_CLASS} group`} style={{ paddingLeft: '2em' }}>
      <span className={ACTIVE_BORDER_CLASS} />
      <span className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm)`} style={{ left: '1.5em' }} />
      <Button
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${workspaceName}`}
        onPress={() => onToggle(workspaceId)}
        className={TOGGLE_BTN_CLASS}
      >
        {workspaceScope === 'collection' ? (
          <Icon icon={collapsed ? 'chevron-right' : 'chevron-down'} className={ICON_CLASS} />
        ) : null}
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left transition-colors">
        <Icon icon={scopeToIconMap[workspaceScope]} className={ICON_CLASS} />
        <span className="min-w-0 flex-1 truncate text-sm">{workspaceName}</span>
      </div>
    </div>
  );
};
