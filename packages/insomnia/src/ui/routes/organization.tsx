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
import {
  type LoaderFunctionArgs,
  NavLink,
  Outlet,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router';
import { useLocalStorage } from 'react-use';

import { getAppWebsiteBaseURL } from '../../common/constants';
import { userSession } from '../../models';
import { isOwnerOfOrganization, isPersonalOrganization, type Organization } from '../../models/organization';
import type { Settings } from '../../models/settings';
import { isScratchpad } from '../../models/workspace';
import { AsyncTask, getInitialRouteForOrganization } from '../../utils/router';
import { getLoginUrl } from '../auth-session-provider';
import { CommandPalette } from '../components/command-palette';
import { GitHubStarsButton } from '../components/github-stars-button';
import { HeaderInviteButton } from '../components/header-invite-button';
import { HeaderUserButton } from '../components/header-user-button';
import { Hotkey } from '../components/hotkey';
import { Icon } from '../components/icon';
import { InsomniaLogo } from '../components/insomnia-icon';
import { showModal } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { SettingsModal, showSettingsModal } from '../components/modals/settings-modal';
import { OrganizationAvatar } from '../components/organization-avatar';
import { PresentUsers } from '../components/present-users';
import { Toast } from '../components/toast';
import { InsomniaEventStreamProvider } from '../context/app/insomnia-event-stream-context';
import { InsomniaTabProvider } from '../context/app/insomnia-tab-context';
import { RunnerProvider } from '../context/app/runner-context';
import { useOrganizationPermissions } from '../hooks/use-organization-features';
import { type CurrentPlan, sortOrganizations, type UserProfileResponse } from '../organization-utils';
import type { WorkspaceLoaderData } from './$organizationId.project.$projectId.workspace.$workspaceId';
import { useRootLoaderData } from './root';
import type { UntrackedProjectsLoaderData } from './untracked-projects';

export interface OrganizationLoaderData {
  organizations: Organization[];
  user?: UserProfileResponse;
  currentPlan?: CurrentPlan;
}

export async function loader(_args: LoaderFunctionArgs) {
  const { id, accountId } = await userSession.getOrCreate();
  if (id) {
    const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
    const user = JSON.parse(localStorage.getItem(`${accountId}:user`) || '{}') as UserProfileResponse;
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

export interface FeatureStatus {
  enabled: boolean;
  reason?: string;
}

export interface FeatureList {
  bulkImport: FeatureStatus;
  gitSync: FeatureStatus;
  orgBasicRbac: FeatureStatus;
}

export interface Billing {
  // If true, the user has paid for the current period
  isActive: boolean;
  expirationWarningMessage: string;
  expirationErrorMessage: string;
  accessDenied: boolean;
}

export interface OrganizationFeatureLoaderData {
  featuresPromise: Promise<FeatureList>;
  billingPromise: Promise<Billing>;
}

export const useOrganizationLoaderData = () => {
  return useRouteLoaderData('/organization') as OrganizationLoaderData;
};

interface IndicatorProps {
  user?: UserProfileResponse;
  asyncTaskStatus: 'error' | 'idle' | 'loading' | 'submitting';
  settings: Settings;
  sync: () => void;
}

const NetworkAndSyncIndicator = ({ user, asyncTaskStatus, settings, sync }: IndicatorProps) => {
  const [status, setStatus] = useState<'online' | 'offline'>('online');
  const navigate = useNavigate();

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
            className="flex h-full items-center justify-center gap-1 px-4 py-1 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
            onPress={() => {
              asyncTaskStatus === 'error' && sync();
            }}
          >
            <Icon
              icon={asyncTaskStatus !== 'error' ? 'spinner' : 'circle'}
              className={`${asyncTaskStatus === 'error' ? 'text-[--color-danger]' : 'text-[--color-font]'} w-5 ${asyncTaskStatus !== 'error' ? 'animate-spin' : ''}`}
            />
            {asyncTaskStatus !== 'error' ? 'Syncing' : 'Sync error: click to retry'}
          </Button>
          <Tooltip
            placement="top"
            offset={8}
            className="flex max-h-[85vh] min-w-max select-none items-center gap-2 overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
          >
            {asyncTaskStatus !== 'error' ? 'Syncing' : 'Sync error: click to retry'}
          </Tooltip>
        </TooltipTrigger>
      ) : (
        <TooltipTrigger>
          <Button
            className="flex h-full items-center justify-center gap-1 px-4 py-1 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
            onPress={() => {
              !user && navigate('/auth/login');
              if (settings.proxyEnabled) {
                showSettingsModal({
                  tab: 'proxy',
                });
              }
            }}
          >
            <Icon
              icon="circle"
              className={user ? (status === 'online' ? 'text-[--color-success]' : 'text-[--color-danger]') : ''}
            />{' '}
            {user ? status.charAt(0).toUpperCase() + status.slice(1) : 'Log in to see your projects'}
            {status === 'online' && settings.proxyEnabled ? ' via proxy' : ''}
          </Button>
          <Tooltip
            placement="top"
            offset={8}
            className="flex max-h-[85vh] min-w-max select-none items-center gap-2 overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
          >
            {user
              ? status === 'online'
                ? 'You have connectivity to the Internet' +
                  (settings.proxyEnabled ? ' via the configured proxy' : '') +
                  '.'
                : 'You are offline. Connect to sync your data.'
              : 'Log in to Insomnia to unlock the full product experience.'}
          </Tooltip>
        </TooltipTrigger>
      )}
    </>
  );
};

const Component = () => {
  const { userSession, settings } = useRootLoaderData();
  const { billing } = useOrganizationPermissions();

  const { organizations, user, currentPlan } = useLoaderData() as OrganizationLoaderData;
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | null;

  const navigate = useNavigate();
  const [isScratchPadBannerDismissed, setIsScratchPadBannerDismissed] = useLocalStorage(
    'scratchpad-banner-dismissed',
    '',
  );
  const isScratchpadWorkspace = workspaceData?.activeWorkspace && isScratchpad(workspaceData.activeWorkspace);
  const isScratchPadBannerVisible = !isScratchPadBannerDismissed && isScratchpadWorkspace;
  const untrackedProjectsFetcher = useFetcher<UntrackedProjectsLoaderData>();
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId?: string;
    workspaceId?: string;
  };

  const location = useLocation();
  const asyncTaskList = location.state?.asyncTaskList as AsyncTask[];

  const syncOrgsAndProjectsFetcher = useFetcher();

  const asyncTaskStatus = syncOrgsAndProjectsFetcher.data?.error ? 'error' : syncOrgsAndProjectsFetcher.state;

  const syncOrgsAndProjects = useCallback(() => {
    const submit = syncOrgsAndProjectsFetcher.submit;

    submit(
      {
        organizationId,
        projectId: projectId || '',
        asyncTaskList,
      },
      {
        action: '/organization/sync-organizations-and-projects',
        method: 'POST',
        encType: 'application/json',
      },
    );
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
      untrackedProjectsFetcher.load('/untracked-projects');
    }
  }, [untrackedProjectsFetcher, organizationId]);

  const untrackedProjects = untrackedProjectsFetcher.data?.untrackedProjects || [];
  const untrackedWorkspaces = untrackedProjectsFetcher.data?.untrackedWorkspaces || [];
  const hasUntrackedData = untrackedProjects.length > 0 || untrackedWorkspaces.length > 0;

  const [isOrganizationSidebarOpen, setIsOganizationSidebarOpen] = useLocalStorage('organizationSidebarOpen', true);
  const [isMinimal, setIsMinimal] = useLocalStorage('isMinimal', false);

  return (
    <InsomniaEventStreamProvider>
      <InsomniaTabProvider>
        <div className="h-full w-full">
          <div
            className={`h-full w-full divide-x divide-solid divide-[--hl-md] ${isOrganizationSidebarOpen ? 'with-navbar' : ''} ${isScratchPadBannerVisible ? 'with-banner' : ''} grid-template-app-layout relative grid bg-[--color-bg]`}
          >
            {!isMinimal && (
              <header className="grid grid-cols-3 items-center border-b border-solid border-[--hl-md] [grid-area:Header]">
                <div className="flex items-center gap-2">
                  <div className="flex w-[50px] shrink-0 justify-center py-2">
                    <InsomniaLogo />
                  </div>
                  {!user ? <GitHubStarsButton /> : null}
                </div>
                <CommandPalette />
                <div className="flex items-center justify-end gap-[--padding-sm] p-2">
                  {user ? (
                    <Fragment>
                      <PresentUsers />
                      <HeaderInviteButton className="border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 font-semibold text-[--color-font-surprise]" />
                      <HeaderUserButton user={user} currentPlan={currentPlan} isMinimal={isMinimal} />
                    </Fragment>
                  ) : (
                    <Fragment>
                      <NavLink
                        to="/auth/login"
                        className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      >
                        Login
                      </NavLink>
                      <NavLink
                        className="flex items-center justify-center gap-2 rounded-sm bg-[--color-surprise] px-4 py-1 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all focus:bg-[rgba(var(--color-surprise-rgb),0.9)] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[rgba(var(--color-surprise-rgb),0.8)]"
                        to="/auth/login"
                      >
                        Sign up for free
                      </NavLink>
                    </Fragment>
                  )}
                </div>
              </header>
            )}
            {isScratchPadBannerVisible ? (
              <div className="flex h-[30px] items-center bg-gradient-to-r from-[#7400e1] to-[#4000bf] text-white [grid-area:Banner]">
                <div className="flex h-full flex-shrink-0 basis-[50px]">
                  <div className="box-border flex h-full w-full items-center justify-center border-l border-r border-solid border-l-[--hl-xl] border-r-[--hl-xl]">
                    <Icon icon="edit" />
                  </div>
                </div>
                <div className="flex h-full w-full items-center overflow-hidden px-[--padding-md] py-[--padding-xs] text-xs">
                  <p className="w-full truncate leading-normal">
                    Welcome to the Scratch Pad where you can work locally with up to 1 collection. To create more and
                    see your projects{' '}
                    <NavLink to="/auth/login" className="inline-flex font-bold text-white">
                      login or create an account →
                    </NavLink>
                  </p>
                </div>
                <Button
                  className="mr-2 flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={() => {
                    setIsScratchPadBannerDismissed('true');
                  }}
                >
                  <Icon icon="x" />
                </Button>
              </div>
            ) : null}
            {isOrganizationSidebarOpen && (
              <div className={`overflow-hidden [grid-area:Navbar] ${isOrganizationSidebarOpen ? '' : 'hidden'}`}>
                <nav className="flex h-full w-full flex-col place-content-stretch items-center gap-[--padding-md] overflow-y-auto py-[--padding-md]">
                  {organizations.map(organization => {
                    const isActive = organization.id === organizationId;

                    return (
                      <TooltipTrigger key={organization.id}>
                        <Link className="relative outline-none">
                          <div
                            className={`box-border flex h-[28px] w-[28px] select-none items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-[#4000BF] to-[#154B62] font-bold text-[--color-font-surprise] outline outline-[3px] outline-offset-[3px] transition-all duration-150 hover:no-underline active:outline ${
                              isActive
                                ? 'outline-[--color-font]'
                                : 'outline-transparent hover:outline-[--hl-md] focus:outline-[--hl-md]'
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
                                {
                                  <Icon
                                    className={`absolute -right-1 -top-1 z-20 h-4 w-4 transition-opacity ease-in-out ${billing?.expirationErrorMessage ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'} ${isActive && (billing.expirationErrorMessage || billing.expirationWarningMessage) ? 'opacity-100' : 'opacity-0'} `}
                                    icon="exclamation-circle"
                                  />
                                }
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <OrganizationAvatar
                                  alt={organization.display_name}
                                  src={organization.branding?.logo_url || ''}
                                />
                                {
                                  <Icon
                                    className={`absolute -right-1 -top-1 z-20 h-4 w-4 transition-opacity ease-in-out ${billing?.expirationErrorMessage ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'} ${isActive && (billing.expirationErrorMessage || billing.expirationWarningMessage) ? 'opacity-100' : 'opacity-0'} `}
                                    icon="exclamation-circle"
                                  />
                                }
                              </div>
                            )}
                          </div>
                        </Link>
                        <Tooltip
                          placement="right"
                          offset={8}
                          className="max-h-[85vh] min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                        >
                          <span>{organization.display_name}</span>
                        </Tooltip>
                      </TooltipTrigger>
                    );
                  })}
                  <MenuTrigger>
                    <Button className="box-border flex h-[28px] w-[28px] select-none items-center justify-center overflow-hidden rounded-md p-[--padding-sm] font-bold text-[--color-font] outline-none transition-all duration-150 hover:no-underline">
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
                        className="max-h-[85vh] min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
                      >
                        <MenuItem
                          id="join-organization"
                          className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                          aria-label="Join an organization"
                        >
                          <Icon icon="city" />
                          <span>Join an organization</span>
                        </MenuItem>
                        <MenuItem
                          id="new-organization"
                          className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
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
            <div className="overflow-hidden border-b border-[--hl-md] [grid-area:Content]">
              <RunnerProvider>
                <Outlet />
              </RunnerProvider>
            </div>
            <div className="relative flex items-center overflow-hidden [grid-area:Statusbar]">
              <div className="flex h-full w-[50px] flex-shrink-0 items-center justify-center gap-2 border-r border-solid border-r-[--hl-md]">
                <TooltipTrigger>
                  <ToggleButton
                    className="h-[10px] w-[10px] flex-grow-0 gap-2 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md]"
                    onChange={setIsOganizationSidebarOpen}
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
                    className="flex max-h-[85vh] min-w-max select-none items-center gap-2 overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                  >
                    Toggle organizations sidebar
                  </Tooltip>
                </TooltipTrigger>
                <TooltipTrigger>
                  <ToggleButton
                    className="h-[10px] w-[10px] flex-grow-0 rotate-90 gap-2 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md]"
                    onChange={flag => {
                      setIsMinimal(!flag);
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
                    className="flex max-h-[85vh] min-w-max select-none items-center gap-2 overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                  >
                    Toggle header
                  </Tooltip>
                </TooltipTrigger>
              </div>
              <div className="flex w-full items-center gap-2">
                <div className="flex h-full flex-shrink flex-grow basis-1/3 items-center">
                  <TooltipTrigger>
                    <Button
                      data-testid="settings-button"
                      className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      onPress={() => showSettingsModal()}
                    >
                      <Icon icon="gear" /> Preferences
                    </Button>
                    <Tooltip
                      placement="top"
                      offset={8}
                      className="flex max-h-[85vh] min-w-max select-none items-center gap-2 overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                    >
                      Preferences
                      <Hotkey keyBindings={settings.hotKeyRegistry.preferences_showGeneral} />
                    </Tooltip>
                  </TooltipTrigger>
                  {hasUntrackedData && !isMinimal ? (
                    <div>
                      <Button
                        className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-[--color-warning] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                        onPress={() => showModal(SettingsModal, { tab: 'data' })}
                      >
                        <Icon icon="exclamation-circle" /> We have detected orphaned projects on your computer, click
                        here to view them.
                      </Button>
                    </div>
                  ) : null}
                  {hasUntrackedData && isMinimal ? (
                    <TooltipTrigger delay={500}>
                      <Button
                        className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-[--color-warning] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                        onPress={() => showModal(SettingsModal, { tab: 'data' })}
                      >
                        <Icon icon="exclamation-circle" />
                      </Button>
                      <Tooltip
                        placement="top"
                        offset={8}
                        className="flex max-h-[85vh] min-w-max select-none items-center gap-2 overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                      >
                        We have detected orphaned projects on your computer, click here to view them.
                      </Tooltip>
                    </TooltipTrigger>
                  ) : null}
                  {isMinimal && (
                    <NetworkAndSyncIndicator
                      user={user}
                      asyncTaskStatus={asyncTaskStatus}
                      settings={settings}
                      sync={syncOrgsAndProjects}
                    />
                  )}
                </div>
                <div className="min-w-[120px] flex-shrink flex-grow basis-1/3">
                  {isMinimal && <CommandPalette style={{ width: '100%' }} />}
                </div>
                <div className="flex flex-shrink flex-grow basis-1/3 justify-end">
                  <div className="divide flex items-center gap-2">
                    {!isMinimal && (
                      <NetworkAndSyncIndicator
                        user={user}
                        asyncTaskStatus={asyncTaskStatus}
                        settings={settings}
                        sync={syncOrgsAndProjects}
                      />
                    )}
                    {!isMinimal && (
                      <Link>
                        <a
                          className="flex items-center gap-1 px-[--padding-md] text-xs text-[--color-font] focus:underline focus:outline-none"
                          href="https://konghq.com/"
                        >
                          Made with
                          <Icon className="text-[--color-surprise-font]" icon="heart" /> by Kong
                        </a>
                      </Link>
                    )}
                  </div>
                  {isMinimal && (
                    <div className="flex items-center justify-end gap-[--padding-sm] p-2">
                      {user ? (
                        <Fragment>
                          <PresentUsers />
                          <HeaderInviteButton className="text-[--color-font]" />
                          <HeaderUserButton user={user} currentPlan={currentPlan} isMinimal={isMinimal} />
                        </Fragment>
                      ) : (
                        <Fragment>
                          <NavLink
                            to="/auth/login"
                            className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                          >
                            Login
                          </NavLink>
                          <NavLink
                            className="flex items-center justify-center gap-2 rounded-sm bg-[--color-surprise] px-4 py-1 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all focus:bg-[rgba(var(--color-surprise-rgb),0.9)] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[rgba(var(--color-surprise-rgb),0.8)]"
                            to="/auth/login"
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
          <Toast />
        </div>
      </InsomniaTabProvider>
    </InsomniaEventStreamProvider>
  );
};

export default Component;
