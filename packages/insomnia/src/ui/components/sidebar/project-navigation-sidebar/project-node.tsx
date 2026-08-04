import type { StorageRules } from 'insomnia-api';
import { models, type Project } from 'insomnia-data';
import { useState } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';

import { ProjectDropdown, type WorkspaceSortOrder } from '~/ui/components/dropdowns/sidebar-project-dropdown';

import { AvatarGroup } from '../../avatar';
import { Icon } from '../../icon';
import { KonnectProjectIcon } from './konnect-project-icon/konnect-project-icon';
import { ACTIVE_BORDER_CLASS, ICON_CLASS, ROW_CLASS, TOGGLE_BTN_CLASS } from './project-navigation-sidebar-utils';
import { type ProjectFlatItem } from './types';

const HOVER_ACTION_BTN_CLASS =
  'flex aspect-square h-6 border border-(--hl-md) items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:opacity-100 focus:ring-(--hl-md) focus:outline-hidden focus:ring-inset aria-pressed:bg-(--hl-sm)';
interface ProjectNodeProps {
  item: ProjectFlatItem;
  storageRules: StorageRules;
  onToggle: (projectId: string) => void;
  sortOrder: WorkspaceSortOrder;
  onSortOrderChange: (newSortOrder: WorkspaceSortOrder) => void;
  onSyncDevPortal: (project: Project) => void;
}

export const ProjectNodeIcon = ({ project }: { project: ProjectFlatItem['doc'] }) => {
  const isDevPortalProject = models.project.isDevPortalProject(project);
  const isControlPlaneProject = models.project.isControlPlaneProject(project);
  const [faviconFailed, setFaviconFailed] = useState(false);

  if (isDevPortalProject && project.devPortalUrl) {
    if (faviconFailed) {
      return <Icon icon="laptop" />;
    }

    return (
      <img
        src={`${project.devPortalUrl}/api/v3/assets/favicon`}
        alt=""
        className="h-5 w-5"
        onError={() => setFaviconFailed(true)}
      />
    );
  }

  if (isControlPlaneProject) {
    return <KonnectProjectIcon konnectDeploymentType={project.konnectDeploymentType} />;
  }

  return (
    <Icon
      icon={
        models.project.isRemoteProject(project)
          ? 'globe-americas'
          : models.project.isGitProject(project)
            ? ['fab', 'git-alt']
            : 'laptop'
      }
    />
  );
};

export const ProjectNode = ({
  item,
  storageRules,
  onToggle,
  sortOrder,
  onSortOrderChange,
  onSyncDevPortal,
}: ProjectNodeProps) => {
  const { doc, collapsed, organizationId } = item;
  const { name: projectName, presence, _id: projectId } = doc;
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const isDevPortalProject = models.project.isDevPortalProject(doc);

  const handleOpenDevPortal = () => {
    if (!models.project.isDevPortalProject(doc)) {
      return;
    }

    window.main.openInBrowser(doc.devPortalUrl);
  };

  return (
    <div
      onContextMenu={e => {
        e.preventDefault();
        setIsContextMenuOpen(true);
      }}
      className={`${ROW_CLASS} group`}
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
        <ProjectNodeIcon project={doc} />
        <span className="min-w-0 flex-1 truncate text-base text-[rgb(var(--color-font-rgb),0.8)]">{projectName}</span>
      </div>
      {presence.length > 0 && <AvatarGroup size="small" maxAvatars={3} items={presence} />}
      {isDevPortalProject && (
        <>
          <TooltipTrigger>
            <Button
              aria-label="Sync APIs"
              className={`${HOVER_ACTION_BTN_CLASS} p-2`}
              onPress={() => onSyncDevPortal(doc)}
            >
              ↙ Fetch
            </Button>
            <Tooltip
              offset={8}
              className="rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-base text-(--color-font) shadow-lg select-none focus:outline-hidden"
            >
              Sync APIs
            </Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <Button aria-label="Open Dev Portal" className={HOVER_ACTION_BTN_CLASS} onPress={handleOpenDevPortal}>
              <Icon icon="arrow-up-right-from-square" />
            </Button>
            <Tooltip
              offset={8}
              className="rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-base text-(--color-font) shadow-lg select-none focus:outline-hidden"
            >
              Open Dev Portal
            </Tooltip>
          </TooltipTrigger>
        </>
      )}
      {projectId !== models.project.SCRATCHPAD_PROJECT_ID && (
        <ProjectDropdown
          organizationId={organizationId}
          project={doc}
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
