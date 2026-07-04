import { models } from 'insomnia-data';
import { type Ref, useEffect, useState } from 'react';
import { Button } from 'react-aria-components';

import type { SortOrder } from '~/common/constants';
import { scopeToBgColorMap, scopeToIconMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';
import { SidebarWorkspaceDropdown } from '~/ui/components/dropdowns/sidebar-workspace-dropdown';
import { EditableInput } from '~/ui/components/editable-input';

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
  // Whether an external trigger (e.g. the rename keyboard shortcut) has requested to rename this workspace.
  isRenaming?: boolean;
  // Called once the rename edit has been entered so the parent can clear its request.
  onRenameHandled?: () => void;
}

export const WorkspaceNode = ({
  item,
  sortOrder,
  onToggle,
  onSortOrderChange,
  highlighted,
  nodeRef,
  isRenaming,
  onRenameHandled,
}: WorkspaceNodeProps) => {
  const { doc, collapsed, project, organizationId, hasUncommittedChanges, hasUnpushedChanges } = item;
  const { name: workspaceName, _id: workspaceId, scope: workspaceScope } = doc;
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const isCollection = workspaceScope === 'collection';
  // The Scratch Pad is a fixed workspace that cannot be renamed (its actions menu omits Rename too).
  const canRename = !models.workspace.isScratchpad(doc);
  const shouldRename = Boolean(isRenaming) && canRename;
  const updateWorkspaceFetcher = useWorkspaceUpdateActionFetcher();

  useEffect(() => {
    if (shouldRename) {
      setIsEditable(true);
    }
  }, [shouldRename]);

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

        {canRename ? (
          <EditableInput
            value={workspaceName}
            name="workspace name"
            ariaLabel={workspaceName}
            editable={shouldRename}
            className="min-w-0 flex-1 text-base hover:bg-transparent!"
            onEditableChange={editable => {
              setIsEditable(editable);
              if (!editable) {
                onRenameHandled?.();
              }
            }}
            onSubmit={newName =>
              updateWorkspaceFetcher.submit({
                organizationId,
                projectId: project._id,
                patch: { name: newName, workspaceId },
              })
            }
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-base">{workspaceName}</span>
        )}
      </div>
      {(hasUncommittedChanges || hasUnpushedChanges) && (
        <div className="flex aspect-square h-6 shrink-0 items-center justify-center">
          <Icon icon="circle" className="h-2 w-2" color="var(--color-warning)" />
        </div>
      )}
      {!isEditable && (
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
      )}
    </div>
  );
};
