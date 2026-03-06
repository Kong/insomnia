import { type Billing, type CurrentPlan, type FeatureList, type Organization, type UserProfile } from 'insomnia-api';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Button,
  Link,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { href, NavLink, Outlet, useLocation, useNavigate, useParams, useRouteLoaderData } from 'react-router';
import * as reactUse from 'react-use';

import { getAppWebsiteBaseURL } from '~/common/constants';
import { userSession } from '~/models';
import { isOwnerOfOrganization, isPersonalOrganization } from '~/models/organization';
import type { Settings } from '~/models/settings';
import { isScratchpad } from '~/models/workspace';
import { useRootLoaderData } from '~/root';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useSyncOrganizationsAndProjectsActionFetcher } from '~/routes/organization.sync-organizations-and-projects';
import { useUntrackedProjectsLoaderFetcher } from '~/routes/untracked-projects';
import { SegmentEvent } from '~/ui/analytics';
import { getLoginUrl } from '~/ui/auth-session-provider.client';
import { CommandPalette } from '~/ui/components/command-palette';
import { GitHubStarsButton } from '~/ui/components/github-stars-button';
import { HeaderInviteButton } from '~/ui/components/header-invite-button';
import { HeaderPlanIndicator } from '~/ui/components/header-plan-indicator';
import { HeaderUserButton } from '~/ui/components/header-user-button';
import { Hotkey } from '~/ui/components/hotkey';
import { Icon } from '~/ui/components/icon';
import { InsomniaLogo } from '~/ui/components/insomnia-icon';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { SettingsModal, showSettingsModal } from '~/ui/components/modals/settings-modal';
import { OrganizationAvatar } from '~/ui/components/organization-avatar';
import { PresentUsers } from '~/ui/components/present-users';
import { InsomniaEventStreamProvider } from '~/ui/context/app/insomnia-event-stream-context';
import { InsomniaTabProvider } from '~/ui/context/app/insomnia-tab-context';
import { RunnerProvider } from '~/ui/context/app/runner-context';
import { useCloseConnection } from '~/ui/hooks/use-close-connection';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { sortOrganizations } from '~/ui/organization-utils';
import { trackTempOrganizationOpened } from '~/ui/temp-segment-tracking';
import { AsyncTask, getInitialRouteForOrganization } from '~/utils/router';

import type { Route } from './+types/organization';

export interface OrganizationLoaderData {
  organizations: Organization[];
  user?: UserProfile;
  currentPlan?: CurrentPlan;
}

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { id, accountId } = await userSession.getOrCreate();
  if (id) {
    const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
    const user = JSON.parse(localStorage.getItem(`${accountId}:user`) || '{}') as UserProfile;
    const currentPlan = JSON.parse(localStorage.getItem(`${accountId}:currentPlan`) || '{}') as CurrentPlan;
    return {
      organizations: sortOrganizations(accountId, organizations),
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

const Component = ({ loaderData }: Route.ComponentProps) => {
  const { organizations, user, currentPlan } = loaderData;
  const { userSession, settings } = useRootLoaderData()!;
  const { billing } = useOrganizationPermissions();

  const workspaceData = useWorkspaceLoaderData();

  const navigate = useNavigate();
  const isScratchpadWorkspace = workspaceData?.activeWorkspace && isScratchpad(workspaceData.activeWorkspace);
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

  // TODO(INS-1912): Remove in 12.5
  useEffect(() => {
    if (organizationId) {
      trackTempOrganizationOpened(organizationId);
    }
  }, [organizationId]);

  const untrackedProjects = untrackedProjectsFetcher.data?.untrackedProjects || [];
  const untrackedWorkspaces = untrackedProjectsFetcher.data?.untrackedWorkspaces || [];
  const hasUntrackedData = untrackedProjects.length > 0 || untrackedWorkspaces.length > 0;

  const [isOrganizationSidebarOpen, setIsOrganizationSidebarOpen] = reactUse.useLocalStorage(
    'organizationSidebarOpen',
    true,
  );

  useCloseConnection({
    organizationId,
  });

  const [isMinimal, setIsMinimal] = reactUse.useLocalStorage('isMinimal', false);
  return (
    <InsomniaEventStreamProvider>
      <InsomniaTabProvider>
        <div className="h-full w-full">
          <div
            className={`h-full w-full divide-x divide-solid divide-(--hl-md) ${isOrganizationSidebarOpen ? 'with-navbar' : ''} grid-template-app-layout relative grid bg-(--color-bg)`}
          >
            {!isMinimal && (
              <header className="grid grid-cols-3 items-center border-b border-solid border-(--hl-md) [grid-area:Header]">
                <div className="flex items-center gap-2">
                  <div className="flex w-[50px] shrink-0 justify-center py-2">
                    <InsomniaLogo />
                  </div>
                  {!user ? <GitHubStarsButton /> : null}
                </div>
                <CommandPalette />
                <div className="flex min-w-min items-center justify-end gap-(--padding-sm) space-x-3 p-2">
                  {user ? (
                    <Fragment>
                      <PresentUsers />
                      <HeaderInviteButton
                        organizationId={organizationId}
                        className="border border-solid border-(--hl-md) bg-(--color-surprise) font-semibold text-(--color-font-surprise)"
                      />
                      <HeaderPlanIndicator isMinimal={isMinimal} />
                      <HeaderUserButton user={user} currentPlan={currentPlan} isMinimal={isMinimal} />
                    </Fragment>
                  ) : (
                    <Fragment>
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
                    </Fragment>
                  )}
                </div>
              </header>
            )}
            {isOrganizationSidebarOpen && (
              <div className={`overflow-hidden [grid-area:Navbar] ${isOrganizationSidebarOpen ? '' : 'hidden'}`}>
                <nav className="flex h-full w-full flex-col place-content-stretch items-center gap-(--padding-md) overflow-y-auto py-(--padding-md)">
                  {organizations.map(organization => {
                    const isActive = organization.id === organizationId;

                    return (
                      <TooltipTrigger key={organization.id}>
                        <Link className="relative outline-hidden">
                          <div
                            className={`box-border flex h-[28px] w-[28px] items-center justify-center overflow-hidden rounded-md bg-linear-to-br from-[#4000BF] to-[#154B62] font-bold text-(--color-font-surprise) outline-[3px] outline-offset-[3px] transition-all duration-150 select-none hover:no-underline active:outline-solid ${
                              isActive
                                ? 'outline-(--color-font)'
                                : 'outline-transparent hover:outline-(--hl-md) focus:outline-(--hl-md)'
                            }`}
                            onClick={async () => {
                              const routeForOrganization = await getInitialRouteForOrganization({
                                organizationId: organization.id,
                              });
                              navigate(routeForOrganization, {
                                state: {
                                  asyncTaskList: [
                                    // we only need sync projects when user switch to another organization
                                    AsyncTask.SyncProjects,
                                  ],
                                },
                              });
                            }}
                          >
                            {isPersonalOrganization(organization) &&
                            isOwnerOfOrganization({
                              organization,
                              accountId: userSession.accountId || '',
                            }) ? (
                              <div className="flex items-center justify-center">
                                <Icon icon="home" />
                                <Icon
                                  className={`absolute -top-1 -right-1 z-10 h-4 w-4 transition-opacity ease-in-out ${billing?.expirationErrorMessage ? 'text-(--color-danger)' : 'text-(--color-warning)'} ${isActive && (billing.expirationErrorMessage || billing.expirationWarningMessage) ? 'opacity-100' : 'opacity-0'} `}
                                  icon="exclamation-circle"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <OrganizationAvatar
                                  alt={organization.display_name}
                                  src={organization.branding?.logo_url || ''}
                                />

                                <Icon
                                  className={`absolute -top-1 -right-1 z-10 h-4 w-4 transition-opacity ease-in-out ${billing?.expirationErrorMessage ? 'text-(--color-danger)' : 'text-(--color-warning)'} ${isActive && (billing.expirationErrorMessage || billing.expirationWarningMessage) ? 'opacity-100' : 'opacity-0'} `}
                                  icon="exclamation-circle"
                                />
                              </div>
                            )}
                          </div>
                        </Link>
                        <Tooltip
                          placement="right"
                          offset={8}
                          className="max-h-[85vh] min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                        >
                          <span>{organization.display_name}</span>
                        </Tooltip>
                      </TooltipTrigger>
                    );
                  })}
                  <MenuTrigger>
                    <Button className="box-border flex h-[28px] w-[28px] items-center justify-center overflow-hidden rounded-md p-(--padding-sm) font-bold text-(--color-font) outline-hidden transition-all duration-150 select-none hover:no-underline">
                      <Icon icon="plus" />
                    </Button>
                    <Popover placement="left" className="min-w-max">
                      <Menu
                        onAction={action => {
                          if (action === 'join-organization') {
                            window.main.openInBrowser(getLoginUrl());
                          }

                          if (action === 'new-organization') {
                            // If user is in the scratchpad workspace redirect them to the login page
                            if (isScratchpadWorkspace) {
                              window.main.openInBrowser(getLoginUrl());
                            }

                            if (!currentPlan) {
                              return;
                            }

                            if (currentPlan.type === 'enterprise-member') {
                              // If user has a team or enterprise member plan show them an alert
                              showModal(AlertModal, {
                                title: 'Cannot create new organization.',
                                message:
                                  'Your Insomnia account is tied to the enterprise corporate account. Please ask the owner of the enterprise billing to create one for you.',
                              });
                            } else if (['free', 'individual'].includes(currentPlan.type)) {
                              // If user has a free or individual plan redirect them to the landing page
                              window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/landing-page`);
                            } else {
                              // If user has a team or enterprise plan redirect them to the create organization page
                              window.main.openInBrowser(
                                `${getAppWebsiteBaseURL()}/app/dashboard/organizations?create_org=true`,
                              );
                            }
                          }
                        }}
                        className="max-h-[85vh] min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                      >
                        <MenuItem
                          id="join-organization"
                          className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                          aria-label="Join an organization"
                        >
                          <Icon icon="city" />
                          <span>Join an organization</span>
                        </MenuItem>
                        <MenuItem
                          id="new-organization"
                          className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                          aria-label="Create new organization"
                        >
                          <Icon icon="sign-out" />
                          <span>Create a new organization</span>
                        </MenuItem>
                      </Menu>
                    </Popover>
                  </MenuTrigger>
                </nav>
              </div>
            )}
            <div className="overflow-hidden border-b border-(--hl-md) [grid-area:Content]">
              <RunnerProvider>
                <Outlet />
              </RunnerProvider>
            </div>
            <div className="relative flex items-center overflow-hidden [grid-area:Statusbar]">
              <div className="flex h-full w-[50px] shrink-0 items-center justify-center gap-2 border-r border-solid border-r-(--hl-md)">
                <TooltipTrigger>
                  <ToggleButton
                    className="h-[10px] w-[10px] grow-0 gap-2 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                    onChange={value => {
                      setIsOrganizationSidebarOpen(value);
                      window.main.trackSegmentEvent({
                        event: SegmentEvent.statusbarLeftbarToggled,
                        properties: {
                          status: value ? 'open' : 'collapsed',
                        },
                      });
                    }}
                    isSelected={isOrganizationSidebarOpen}
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
                    Toggle organizations sidebar
                  </Tooltip>
                </TooltipTrigger>
                <TooltipTrigger>
                  <ToggleButton
                    className="h-[10px] w-[10px] grow-0 rotate-90 gap-2 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                    onChange={flag => {
                      setIsMinimal(!flag);
                      window.main.trackSegmentEvent({
                        event: SegmentEvent.statusbarTopbarToggled,
                        properties: {
                          status: !flag ? 'minimal' : 'expanded',
                        },
                      });
                    }}
                    isSelected={!isMinimal}
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
                    Toggle header
                  </Tooltip>
                </TooltipTrigger>
              </div>
              <div className="flex w-full items-center gap-2">
                <div className="flex h-full shrink grow basis-1/3 items-center">
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
                  {!isScratchpadWorkspace && hasUntrackedData && !isMinimal ? (
                    <div>
                      <Button
                        className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-warning) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                        onPress={() => {
                          window.main.trackSegmentEvent({
                            event: SegmentEvent.statusbarOrphanedProjectsClicked,
                          });
                          showModal(SettingsModal, { tab: 'data' });
                        }}
                      >
                        <Icon icon="exclamation-circle" /> We have detected orphaned projects on your computer, click
                        here to view them.
                      </Button>
                    </div>
                  ) : null}
                  {!isScratchpadWorkspace && hasUntrackedData && isMinimal ? (
                    <TooltipTrigger delay={500}>
                      <Button
                        className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-warning) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                        onPress={() => {
                          window.main.trackSegmentEvent({
                            event: SegmentEvent.statusbarOrphanedProjectsClicked,
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
                  ) : null}
                  {isMinimal && (
                    <NetworkAndSyncIndicator
                      asyncTaskStatus={asyncTaskStatus}
                      settings={settings}
                      sync={syncOrgsAndProjects}
                    />
                  )}
                </div>
                <div className="min-w-[120px] shrink grow basis-1/3">
                  {isMinimal && <CommandPalette style={{ width: '100%' }} />}
                </div>
                <div className="flex shrink grow basis-1/3 justify-end">
                  <div className="flex items-center gap-2">
                    {!isMinimal && (
                      <NetworkAndSyncIndicator
                        asyncTaskStatus={asyncTaskStatus}
                        settings={settings}
                        sync={syncOrgsAndProjects}
                      />
                    )}
                    {!isMinimal && (
                      <Link>
                        <a
                          className="flex items-center gap-1 px-(--padding-md) text-xs text-(--color-font) focus:underline focus:outline-hidden"
                          href="https://konghq.com/"
                        >
                          Made with
                          <Icon className="text-(--color-surprise-font)" icon="heart" /> by Kong
                        </a>
                      </Link>
                    )}
                  </div>
                  {isMinimal && (
                    <div className="flex items-center justify-end gap-(--padding-sm) p-2">
                      {user ? (
                        <Fragment>
                          <PresentUsers />
                          <HeaderInviteButton className="text-(--color-font)" organizationId={organizationId} />
                          <HeaderPlanIndicator isMinimal={isMinimal} />
                          <HeaderUserButton user={user} currentPlan={currentPlan} isMinimal={isMinimal} />
                        </Fragment>
                      ) : (
                        <Fragment>
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
                        </Fragment>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </InsomniaTabProvider>
    </InsomniaEventStreamProvider>
  );
};

export default Component;
