import type { StorageRules } from 'insomnia-api';
import type React from 'react';
import { Button, GridList, GridListItem, Input, SearchField } from 'react-aria-components';
import { useNavigate } from 'react-router';
import * as reactUse from 'react-use';

import type { GitRepository, Project } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import type { SyncResult } from '~/konnect/sync';
import { AnalyticsEvent } from '~/ui/analytics';

import { useKonnectSync } from '../../hooks/use-konnect-sync';
import { AvatarGroup } from '../avatar';
import { ProjectDropdown } from '../dropdowns/project-dropdown';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';

export type ProjectWithPresence = Project & {
  gitRepository?: GitRepository;
  presence: {
    key: string;
    alt: string;
    src: string;
  }[];
};

interface ProjectListSidebarProps {
  organizationId: string;
  activeProjectId?: string;
  projects: ProjectWithPresence[];
  storageRules: StorageRules;
  onCreateProject: () => void;
  konnectSyncEnabled: boolean;
}

const TAB_CLASS_ACTIVE = 'border-b-2 border-solid border-b-(--color-surprise) px-3 py-1 text-xs uppercase text-(--color-font)';
const TAB_CLASS_INACTIVE = 'px-3 py-1 text-xs uppercase text-(--hl) hover:bg-(--hl-xs)';

const ROW_CLASS = 'relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font)';

const ACTION_BUTTON_CLASS = 'flex h-full items-center gap-1 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)';

const ProjectGridList = ({ label, items, activeProjectId, organizationId, children }: {
  label: string;
  items: ProjectWithPresence[];
  activeProjectId?: string;
  organizationId: string;
  children: (item: ProjectWithPresence) => React.ReactNode;
}) => {
  const navigate = useNavigate();
  return (
    <GridList
      aria-label={label}
      items={items}
      className="flex-1 overflow-y-auto py-(--padding-sm) data-empty:py-0"
      disallowEmptySelection
      selectedKeys={activeProjectId ? [activeProjectId] : ['']}
      selectionMode="single"
      onSelectionChange={keys => {
        if (keys !== 'all') {
          const [value] = keys.values();
          navigate({ pathname: `/organization/${organizationId}/project/${value}` });
        }
      }}
    >
      {item => (
        <GridListItem key={item._id} id={item._id} textValue={item.name} className="group outline-hidden select-none">
          <div className={ROW_CLASS}>
            <span className="absolute top-0 left-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)" />
            {children(item)}
          </div>
        </GridListItem>
      )}
    </GridList>
  );
};

const FilterSearchField = ({ label, value, onChange, isDisabled }: { label: string; value: string; onChange: (value: string) => void; isDisabled?: boolean }) => (
  <SearchField aria-label={label} className="group relative flex-1" value={value} onChange={onChange} isDisabled={isDisabled}>
    <Input
      placeholder="Filter"
      className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
    />
    <div className="absolute top-0 right-0 flex h-full items-center px-2">
      <Button className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
        <Icon icon="close" />
      </Button>
    </div>
  </SearchField>
);

const filterByName = (items: ProjectWithPresence[], query: string | undefined) =>
  query ? items.filter(p => p.name?.toLowerCase().includes(query.toLowerCase())) : items;

function showSkippedRoutesModal(result: SyncResult | null) {
  if (!result?.success || !result.skippedRoutes.length) { return; }
  const byService = new Map<string, string[]>();
  for (const { serviceName, routeName, reason } of result.skippedRoutes) {
    const list = byService.get(serviceName) ?? [];
    list.push(`${routeName} — ${reason}`);
    byService.set(serviceName, list);
  }
  showModal(AlertModal, {
    title: 'Skipped Routes',
    message: (
      <div>
        <p>{result.skippedRoutes.length} route(s) were skipped because they cannot be represented in Insomnia:</p>
        {[...byService.entries()].map(([service, routes]) => (
          <div key={service} style={{ margin: '8px 0' }}>
            <strong>{service}</strong>
            <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
              {routes.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>
        ))}
      </div>
    ),
  });
}

export const ProjectListSidebar = ({
  organizationId,
  activeProjectId,
  projects,
  storageRules,
  onCreateProject,
  konnectSyncEnabled,
}: ProjectListSidebarProps) => {

  const [storedTab, setActiveTab] = reactUse.useLocalStorage<'projects' | 'konnect'>(
    `${organizationId}:sidebar-tab`,
    'projects',
  );
  const activeTab = !konnectSyncEnabled ? 'projects' : (storedTab ?? 'projects');

  const [projectListFilter, setProjectListFilter] = reactUse.useLocalStorage(
    `${organizationId}:project-list-filter`,
    '',
  );

  const [konnectFilter, setKonnectFilter] = reactUse.useLocalStorage(
    `${organizationId}:konnect-filter`,
    '',
  );

  const { syncing, progress, error: syncError, startSync, cancelSync } = useKonnectSync();

  const nonKonnectProjects = projects.filter(p => !p.konnectControlPlaneId);
  const konnectProjects = projects.filter(p => p.konnectControlPlaneId != null);

  const filteredProjects = filterByName(nonKonnectProjects, projectListFilter);
  const filteredKonnectProjects = filterByName(konnectProjects, konnectFilter);

  const handleSync = async () => {
    if (!konnectSyncEnabled) {
      return;
    }

    const runAndNotify = async () => {
      const result = await startSync(organizationId);
      showSkippedRoutesModal(result);
    };

    const isResync = konnectProjects.length > 0;
    if (isResync) {
      showModal(AskModal, {
        title: 'Re-sync Konnect',
        message: (
          <div>
            <p>Re-syncing will make the following changes:</p>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li><strong>Reset</strong> — request method, URL, name, and Konnect-managed headers</li>
              <li><strong>Delete</strong> — requests added manually or no longer in Konnect</li>
              <li><strong>Preserve</strong> — body, auth, query params, scripts, description, and user-added headers</li>
            </ul>
            <p>This cannot be undone. Continue?</p>
          </div>
        ),
        yesText: 'Re-sync',
        noText: 'Cancel',
        color: 'warning',
        onDone: async (confirmed: boolean) => {
          if (confirmed) {
            await runAndNotify();
          }
        },
      });
    } else {
      await runAndNotify();
    }
  };

  const tabBar = (
    <div className="flex shrink-0 border-b border-solid border-b-(--hl-md)">
      <button className={activeTab === 'projects' ? TAB_CLASS_ACTIVE : TAB_CLASS_INACTIVE} onClick={() => setActiveTab('projects')}>
        Projects ({nonKonnectProjects.length})
      </button>
      {konnectSyncEnabled && (
        <button className={activeTab === 'konnect' ? TAB_CLASS_ACTIVE : TAB_CLASS_INACTIVE} onClick={() => setActiveTab('konnect')}>
          Konnect ({konnectProjects.length})
        </button>
      )}
    </div>
  );

  if (activeTab === 'konnect' && konnectSyncEnabled) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        {tabBar}
        <div className="flex justify-between gap-1 p-(--padding-sm)">
          <FilterSearchField label="Konnect filter" value={konnectFilter || ''} onChange={setKonnectFilter} />
          {syncing ? (
            <Button
              aria-label="Cancel sync"
              onPress={() => cancelSync()}
              className={ACTION_BUTTON_CLASS}
            >
              Cancel
              <Icon icon="stop-circle" />
            </Button>
          ) : (
            <Button
              aria-label="Sync Konnect"
              onPress={handleSync}
              className={ACTION_BUTTON_CLASS}
            >
              Sync
              <Icon icon="refresh" />
            </Button>
          )}
        </div>

        {syncing && (
          <p className="truncate px-4 pb-1 text-xs text-(--hl) italic">{progress}</p>
        )}
        {syncError && (
          <p className="px-4 pb-1 text-xs text-(--color-danger)">{syncError}</p>
        )}

        <ProjectGridList label="Konnect projects" items={filteredKonnectProjects} activeProjectId={activeProjectId} organizationId={organizationId}>
          {item => {
            return (
              <>
                <Icon icon='server' />
                <span className="truncate">{item.name}</span>
              </>
            );
          }}
        </ProjectGridList>

        {konnectProjects.length === 0 && !syncing && (
          <p className="px-4 py-2 text-xs text-(--hl) italic">
            No Konnect projects yet. Click sync to import your control planes.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {tabBar}
      <div className="flex justify-between gap-1 p-(--padding-sm)">
        <FilterSearchField
          label="Projects filter"
          value={projectListFilter || ''}
          isDisabled={nonKonnectProjects.length === 0}
          onChange={value => {
            setProjectListFilter(value);
            if (value.trim() !== '') {
              window.main.trackAnalyticsEvent({ event: AnalyticsEvent.filterCreatedProjects });
            }
          }}
        />
        <Button
          aria-label="Create new Project"
          onPress={onCreateProject}
          className="flex aspect-square h-full items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <Icon icon="plus-circle" />
        </Button>
      </div>

      <ProjectGridList label="Projects" items={filteredProjects} activeProjectId={activeProjectId} organizationId={organizationId}>
        {item => (
          <>
            <Icon icon={models.project.isRemoteProject(item) ? 'globe-americas' : models.project.isGitProject(item) ? ['fab', 'git-alt'] : 'laptop'} />
            <span className="truncate">{item.name}</span>
            <span className="flex-1" />
            {item.presence.length > 0 && <AvatarGroup size="small" maxAvatars={3} items={item.presence} />}
            {item._id !== models.project.SCRATCHPAD_PROJECT_ID && (
              <ProjectDropdown organizationId={organizationId} project={item} storageRules={storageRules} />
            )}
          </>
        )}
      </ProjectGridList>
    </div>
  );
};
