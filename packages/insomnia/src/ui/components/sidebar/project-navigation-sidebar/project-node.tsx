import { models } from 'insomnia-data';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import type { StorageRules } from '~/common/organization-storage-rules';
import { ProjectDropdown, type WorkspaceSortOrder } from '~/ui/components/dropdowns/sidebar-project-dropdown';

import { Icon } from '../../icon';
import { ACTIVE_BORDER_CLASS, ICON_CLASS, ROW_CLASS, TOGGLE_BTN_CLASS } from './styles';
import { type ProjectFlatItem } from './types';
interface ProjectNodeProps {
  item: ProjectFlatItem;
  storageRules: StorageRules;
  onToggle: (projectId: string) => void;
  sortOrder: WorkspaceSortOrder;
  onSortOrderChange: (newSortOrder: WorkspaceSortOrder) => void;
  onDelete: () => void;
}

export const ProjectNode = ({
  item,
  storageRules,
  onToggle,
  sortOrder,
  onSortOrderChange,
  onDelete,
}: ProjectNodeProps) => {
  const { doc, collapsed, organizationId, showSyncStatus = false } = item;
  const { name: projectName, _id: projectId } = doc;
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  const hasUncommittedOrUnpushedChanges =
    showSyncStatus || doc.gitRepository?.hasUncommittedChanges || doc.gitRepository?.hasUnpushedChanges;

  return (
    <div
      onContextMenu={e => {
        e.preventDefault();
        setIsContextMenuOpen(true);
      }}
      className={ROW_CLASS}
      style={{ paddingLeft: '1em' }}
      data-testid={`project-node-${projectName}`}
    >
      <span className={ACTIVE_BORDER_CLASS} />
      <Button slot="drag" className="hidden" />
      <Button
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${projectName}`}
        onPress={() => onToggle(projectId)}
        className={TOGGLE_BTN_CLASS}
      >
        <Icon icon={collapsed ? 'chevron-right' : 'chevron-down'} className={ICON_CLASS} />
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left transition-colors">
        <Icon icon={models.project.isGitProject(doc) ? ['fab', 'git-alt'] : 'laptop'} />
        <span className="min-w-0 flex-1 truncate text-base text-[rgb(var(--color-font-rgb),0.8)]">{projectName}</span>
      </div>
      {projectId && (
        <ProjectDropdown
          organizationId={organizationId}
          project={{
            ...doc,
            hasUncommittedOrUnpushedChanges,
          }}
          storageRules={storageRules}
          sortOrder={sortOrder}
          onSortOrderChange={onSortOrderChange}
          isOpen={isContextMenuOpen}
          onOpenChange={setIsContextMenuOpen}
          onDelete={onDelete}
        />
      )}
    </div>
  );
};
