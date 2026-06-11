import { type Billing, type CurrentPlan, type FeatureList, type Organization, type User } from 'insomnia-api';
import type { Settings } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Link, ToggleButton, Tooltip, TooltipTrigger } from 'react-aria-components';
import { href, NavLink, Outlet, useLocation, useNavigate, useParams, useRouteLoaderData } from 'react-router';
import * as reactUse from 'react-use';

import { useRootLoaderData } from '~/root';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useSyncOrganizationsAndProjectsActionFetcher } from '~/routes/organization.sync-organizations-and-projects';
import { useUntrackedProjectsLoaderFetcher } from '~/routes/untracked-projects';
import { AnalyticsEvent } from '~/ui/analytics';
import { CommandPalette } from '~/ui/components/command-palette';
import { GitHubStarsButton } from '~/ui/components/github-stars-button';
import { HeaderInviteButton } from '~/ui/components/header-invite-button';
import { HeaderPlanIndicator } from '~/ui/components/header-plan-indicator';
import { HeaderUserButton } from '~/ui/components/header-user-button';
import { Hotkey } from '~/ui/components/hotkey';
import { Icon } from '~/ui/components/icon';
import { InsomniaLogo } from '~/ui/components/insomnia-icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { showModal } from '~/ui/components/modals';
import { SettingsModal, showSettingsModal } from '~/ui/components/modals/settings-modal';
import { PresentUsers } from '~/ui/components/present-users';
import { OrganizationSelect } from '~/ui/components/project/organization-select';
import { InsomniaEventStreamProvider } from '~/ui/context/app/insomnia-event-stream-context';
import { SidebarContext } from '~/ui/context/app/insomnia-sidebar-context';
import { InsomniaTabProvider } from '~/ui/context/app/insomnia-tab-context';
import { RunnerProvider } from '~/ui/context/app/runner-context';
import { useCloseConnection } from '~/ui/hooks/use-close-connection';
import type { AsyncTask } from '~/utils/router';

import type { Route } from './+types/organization';

export interface OrganizationLoaderData {
  organizations: Organization[];
  user?: User;
  currentPlan?: CurrentPlan;
}

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id, accountId } = await services.userSession.get();
  if (id) {
    const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
    const user = JSON.parse(localStorage.getItem(`${accountId}:user`) || '{}') as User;
    const currentPlan = JSON.parse(localStorage.getItem(`${accountId}:currentPlan`) || '{}') as CurrentPlan;
    return {
      organizations,
      user,
      currentPlan,
    };
  }
  return {
    organizations: [],
    user: undefined,
    currentPlan: undefined,
  };
}

export interface OrganizationFeatureLoaderData {
  featuresPromise: Promise<FeatureList>;
  billingPromise: Promise<Billing>;
}

export const useOrganizationLoaderData = () => {
  return useRouteLoaderData<typeof clientLoader>('routes/organization');
};

interface IndicatorProps {
  asyncTaskStatus: 'error' | 'idle' | 'loading' | 'submitting';
  settings: Settings;
  sync: () => void;
}

const NetworkAndSyncIndicator = ({ asyncTaskStatus, settings, sync }: IndicatorProps) => {
  const [status, setStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* The sync indicator only show when network status is online */}
      {/* use for show sync organization and projects status(1. first enter app 2. switch organization) */}
      {status === 'online' && asyncTaskStatus !== 'idle' ? (
        <TooltipTrigger>
          <Button
            className="flex h-full items-center justify-center gap-1 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            onPress={() => {
              asyncTaskStatus === 'error' && sync();
            }}
          >
            <Icon
              icon={asyncTaskStatus !== 'error' ? 'spinner' : 'circle'}
              className={`${asyncTaskStatus === 'error' ? 'text-(--color-danger)' : 'text-(--color-font)'} w-5 ${asyncTaskStatus !== 'error' ? 'animate-spin' : ''}`}
            />
            {asyncTaskStatus !== 'error' ? 'Syncing' : 'Sync error: click to retry'}
          </Button>
          <Tooltip
            placement="top"
            offset={8}
            className="flex max-h-[85vh] min-w-max items-center gap-2 overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
          >
            {asyncTaskStatus !== 'error' ? 'Syncing' : 'Sync error: click to retry'}
          </Tooltip>
        </TooltipTrigger>
      ) : (
        <TooltipTrigger>
          <Button
            className="flex h-full items-center justify-center gap-1 px-4 py-1 text-xs text-(--color-font) capitalize ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            onPress={() => {
              if (settings.proxyEnabled) {
                showSettingsModal({
                  tab: 'proxy',
                });
              }
            }}
          >
            <Icon icon="circle" className={status === 'online' ? 'text-(--color-success)' : 'text-(--color-danger)'} />{' '}
            {status}
            {status === 'online' && settings.proxyEnabled ? ' via proxy' : ''}
          </Button>
          <Tooltip
            placement="top"
            offset={8}
            className="flex max-h-[85vh] min-w-max items-center gap-2 overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
          >
            {status === 'online'
              ? 'You have connectivity to the Internet' +
                (settings.proxyEnabled ? ' via the configured proxy' : '') +
                '.'
              : 'You are offline. Connect to sync your data.'}
          </Tooltip>
        </TooltipTrigger>
      )}
    </>
  );
};

const ScratchPadAuthActions = () => (
  <>
    <NavLink
      to={href('/auth/login')}
      className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
    >
      Login
    </NavLink>
    <NavLink
      className="flex items-center justify-center gap-2 rounded-xs bg-(--color-surprise) px-4 py-1 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all focus:bg-[rgba(var(--color-surprise-rgb),0.9)] focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-[rgba(var(--color-surprise-rgb),0.8)]"
      to={href('/auth/login')}
    >
      Sign up for free
    </NavLink>
  </>
);

const LoginUserActions = ({
  organizationId,
  isMinimal,
  user,
  currentPlan,
}: {
  organizationId: string;
  isMinimal: boolean;
  user: User;
  currentPlan?: CurrentPlan;
}) => {
  return (
    <>
      <PresentUsers />
      <HeaderInviteButton
        organizationId={organizationId}
        className={
          !isMinimal
            ? 'border border-solid border-(--hl-md) bg-(--color-surprise) font-semibold text-(--color-font-surprise)'
            : 'text-(--color-font)'
        }
      />
      <HeaderPlanIndicator isMinimal={isMinimal} />
      <HeaderUserButton user={user} currentPlan={currentPlan} isMinimal={isMinimal} />
    </>
  );
};

const Component = ({ loaderData }: Route.ComponentProps) => {
  const { organizations, user, currentPlan } = loaderData;
  const { settings } = useRootLoaderData()!;

  const workspaceData = useWorkspaceLoaderData();

  const navigate = useNavigate();
  const isScratchpadWorkspace =
    workspaceData?.activeWorkspace && models.workspace.isScratchpad(workspaceData.activeWorkspace);
  const untrackedProjectsFetcher = useUntrackedProjectsLoaderFetcher();
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId?: string;
    workspaceId?: string;
  };

  const location = useLocation();
  const asyncTaskList = location.state?.asyncTaskList as AsyncTask[];

  const syncOrgsAndProjectsFetcher = useSyncOrganizationsAndProjectsActionFetcher();

  const asyncTaskStatus = syncOrgsAndProjectsFetcher.data?.error ? 'error' : syncOrgsAndProjectsFetcher.state;

  const syncOrgsAndProjects = useCallback(() => {
    const submit = syncOrgsAndProjectsFetcher.submit;

    submit({
      organizationId,
      projectId: projectId || '',
      asyncTaskList,
    });
  }, [asyncTaskList, organizationId, syncOrgsAndProjectsFetcher.submit, projectId]);

  useEffect(() => {
    // each route navigation will change history state, only submit this action when the asyncTaskList state is not empty
    // currently we have 2 cases that will set the asyncTaskList state
    // 1. first entry
    // 2. when user switch to another organization
    if (asyncTaskList?.length) {
      syncOrgsAndProjects();
    }
  }, [organizationId, asyncTaskList, syncOrgsAndProjects]);

  useEffect(() => {
    const isIdleAndUninitialized = untrackedProjectsFetcher.state === 'idle' && !untrackedProjectsFetcher.data;
    if (isIdleAndUninitialized) {
      untrackedProjectsFetcher.load();
    }
  }, [organizationId, untrackedProjectsFetcher]);

  useEffect(() => {
    window.main.setCurrentOrganizationId(organizationId);
    return () => window.main.setCurrentOrganizationId(undefined);
  }, [organizationId]);

  const untrackedProjects = untrackedProjectsFetcher.data?.untrackedProjects || [];
  const untrackedWorkspaces = untrackedProjectsFetcher.data?.untrackedWorkspaces || [];
  const hasUntrackedData = untrackedProjects.length > 0 || untrackedWorkspaces.length > 0;
  const isScratchPad = organizationId === models.organization.SCRATCHPAD_ORGANIZATION_ID;

  useCloseConnection({
    organizationId,
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = reactUse.useLocalStorage('project-navigation-collapsed', false);

  const toggleSidebar = useCallback(
    () => setIsSidebarCollapsed(!isSidebarCollapsed),
    [isSidebarCollapsed, setIsSidebarCollapsed],
  );

  useEffect(() => {
    return window.main.on('toggle-sidebar', () => {
      toggleSidebar();
    });
  }, [toggleSidebar]);

  useDocBodyKeyboardShortcuts({ sidebar_toggle: toggleSidebar });

  return (
    <InsomniaEventStreamProvider>
      <InsomniaTabProvider>
        <SidebarContext.Provider value={{ isSidebarCollapsed: isSidebarCollapsed ?? false, toggleSidebar }}>
          <div className="h-full w-full">
            <div
              className={`grid-template-app-layout relative grid h-full w-full divide-x divide-solid divide-(--hl-md) bg-(--color-bg)`}
            >
              <header className="grid grid-cols-3 items-center border-b border-solid border-(--hl-md) [grid-area:Header]">
                <div className="flex items-center gap-2">
                  <div className="flex w-12.5 shrink-0 justify-center py-2">
                    <InsomniaLogo />
                  </div>
                  {!isScratchPad && (
                    <OrganizationSelect
                      organizationId={organizationId}
                      organizations={organizations || []}
                      onSelect={id => {
                        window.main.trackAnalyticsEvent({ event: AnalyticsEvent.organizationSwitched });
                        navigate(`/organization/${id}`);
                      }}
                      currentPlan={currentPlan}
                      isScratchpadWorkspace={!!isScratchpadWorkspace}
                    />
                  )}

                  {!user ? <GitHubStarsButton /> : null}
                </div>
                <CommandPalette />
                <div className="flex min-w-min items-center justify-end gap-(--padding-sm) space-x-3 p-2">
                  {user ? (
                    <LoginUserActions
                      organizationId={organizationId}
                      isMinimal={false}
                      user={user}
                      currentPlan={currentPlan}
                    />
                  ) : (
                    <ScratchPadAuthActions />
                  )}
                </div>
              </header>
              <div className="overflow-hidden border-b border-(--hl-md) [grid-area:Content]">
                <RunnerProvider>
                  <Outlet />
                </RunnerProvider>
              </div>
              <div className="relative flex items-center overflow-hidden [grid-area:Statusbar]" data-testid="statusbar">
                <div className="flex w-full items-center gap-2">
                  <div className="flex h-full shrink grow basis-1/3 items-center">
                    <TooltipTrigger>
                      <ToggleButton
                        className="ml-3 grow-0 gap-2 px-2 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset"
                        onChange={value => {
                          setIsSidebarCollapsed(!value);
                        }}
                        isSelected={!isSidebarCollapsed}
                      >
                        {({ isSelected }) => {
                          return (
                            <svg
                              width={10}
                              height={10}
                              viewBox="0 0 16 16"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="currentColor"
                            >
                              {isSelected ? (
                                <path
                                  fillRule="evenodd"
                                  clipRule="evenodd"
                                  d="M2 1L1 2v12l1 1h12l1-1V2l-1-1H2zm12 13H7V2h7v12z"
                                />
                              ) : (
                                <path d="M2 1L1 2v12l1 1h12l1-1V2l-1-1H2zm0 13V2h4v12H2zm5 0V2h7v12H7z" />
                              )}
                            </svg>
                          );
                        }}
                      </ToggleButton>
                      <Tooltip
                        placement="top"
                        offset={8}
                        className="flex max-h-[85vh] min-w-max items-center gap-2 overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                      >
                        Toggle sidebar
                      </Tooltip>
                    </TooltipTrigger>
                    <TooltipTrigger>
                      <Tooltip
                        placement="top"
                        offset={8}
                        className="flex max-h-[85vh] min-w-max items-center gap-2 overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                      >
                        Toggle header
                      </Tooltip>
                    </TooltipTrigger>
                    <TooltipTrigger>
                      <Button
                        data-testid="settings-button"
                        className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                        onPress={() => showSettingsModal()}
                      >
                        <Icon icon="gear" /> Preferences
                      </Button>
                      <Tooltip
                        placement="top"
                        offset={8}
                        className="flex max-h-[85vh] min-w-max items-center gap-2 overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                      >
                        Preferences
                        <Hotkey keyBindings={settings.hotKeyRegistry.preferences_showGeneral} />
                      </Tooltip>
                    </TooltipTrigger>
                    {!isScratchpadWorkspace && hasUntrackedData && (
                      <TooltipTrigger delay={500}>
                        <Button
                          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-warning) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                          onPress={() => {
                            window.main.trackAnalyticsEvent({
                              event: AnalyticsEvent.statusbarOrphanedProjectsClicked,
                            });
                            showModal(SettingsModal, { tab: 'data' });
                          }}
                        >
                          <Icon icon="exclamation-circle" />
                        </Button>
                        <Tooltip
                          placement="top"
                          offset={8}
                          className="flex max-h-[85vh] min-w-max items-center gap-2 overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                        >
                          We have detected orphaned projects on your computer, click here to view them.
                        </Tooltip>
                      </TooltipTrigger>
                    )}
                  </div>
                  <div className="flex shrink grow basis-1/3 justify-end">
                    <div className="flex items-center gap-2">
                      <NetworkAndSyncIndicator
                        asyncTaskStatus={asyncTaskStatus}
                        settings={settings}
                        sync={syncOrgsAndProjects}
                      />

                      <Link>
                        <a
                          className="flex items-center gap-1 px-(--padding-md) text-xs text-(--color-font) focus:underline focus:outline-hidden"
                          href="https://konghq.com/"
                        >
                          Made with
                          <Icon className="text-(--color-surprise-font)" icon="heart" /> by Kong
                        </a>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarContext.Provider>
      </InsomniaTabProvider>
    </InsomniaEventStreamProvider>
  );
};

export default Component;
