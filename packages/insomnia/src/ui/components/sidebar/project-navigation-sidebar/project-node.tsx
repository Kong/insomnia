import type { StorageRules } from 'insomnia-api';
import { models } from 'insomnia-data';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import { useRootLoaderData } from '~/root';
import { useProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId';
import { ProjectDropdown, type WorkspaceSortOrder } from '~/ui/components/dropdowns/sidebar-project-dropdown';
import { useInsomniaEventStreamContext } from '~/ui/context/app/insomnia-event-stream-context';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';

import { AvatarGroup } from '../../avatar';
import { Icon } from '../../icon';
import { KonnectProjectIcon } from './konnect-project-icon/konnect-project-icon';
import { ACTIVE_BORDER_CLASS, ICON_CLASS, ROW_CLASS, TOGGLE_BTN_CLASS } from './project-navigation-sidebar-utils';
import { type ProjectFlatItem } from './types';
interface ProjectNodeProps {
  item: ProjectFlatItem;
  storageRules: StorageRules;
  onToggle: (projectId: string) => void;
  sortOrder: WorkspaceSortOrder;
  onSortOrderChange: (newSortOrder: WorkspaceSortOrder) => void;
}

export const ProjectNode = ({ item, storageRules, onToggle, sortOrder, onSortOrderChange }: ProjectNodeProps) => {
  const { doc, collapsed, organizationId } = item;
  const { userSession } = useRootLoaderData()!;
  const { presence } = useInsomniaEventStreamContext();
  const { name: projectName, _id: projectId } = doc;
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const { projectsSyncStatusPromise } = useProjectLoaderData()!;
  const [checkAllProjectSyncStatus] = useLoaderDeferData<Record<string, boolean>>(
    projectsSyncStatusPromise,
    organizationId,
  );
  const hasUncommittedOrUnpushedChanges =
    checkAllProjectSyncStatus?.[projectId] ||
    doc.gitRepository?.hasUncommittedChanges ||
    doc.gitRepository?.hasUnpushedChanges;

  const projectPresence = presence
    .filter(p => p.project === doc.remoteId)
    .filter(p => p.acct !== userSession.accountId)
    .map(user => {
      return {
        key: user.acct,
        alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
        src: user.avatar,
      };
    });

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
        {doc.konnectControlPlaneId ? (
          <KonnectProjectIcon konnectDeploymentType={doc.konnectDeploymentType} />
        ) : (
          <Icon
            icon={
              models.project.isRemoteProject(doc)
                ? 'globe-americas'
                : models.project.isGitProject(doc)
                  ? ['fab', 'git-alt']
                  : 'laptop'
            }
          />
        )}
        <span className="min-w-0 flex-1 truncate text-base text-[rgb(var(--color-font-rgb),0.8)]">{projectName}</span>
      </div>
      {projectPresence.length > 0 && <AvatarGroup size="small" maxAvatars={3} items={projectPresence} />}{' '}
      {projectId !== models.project.SCRATCHPAD_PROJECT_ID && (
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
        />
      )}
    </div>
  );
};
