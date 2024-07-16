import React, { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Button,
  Link,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  ProgressBar,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import {
  type ActionFunction,
  type LoaderFunction,
  NavLink,
  Outlet,
  redirect,
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import * as session from '../../account/session';
import { getAppWebsiteBaseURL } from '../../common/constants';
import { database } from '../../common/database';
import { userSession } from '../../models';
import { updateLocalProjectToRemote } from '../../models/helpers/project';
import { findPersonalOrganization, isOwnerOfOrganization, isPersonalOrganization, isScratchpadOrganizationId, type Organization } from '../../models/organization';
import { type Project, type as ProjectType } from '../../models/project';
import { isDesign, isScratchpad } from '../../models/workspace';
import { VCSInstance } from '../../sync/vcs/insomnia-sync';
import { migrateProjectsIntoOrganization, shouldMigrateProjectUnderOrganization } from '../../sync/vcs/migrate-projects-into-organization';
import { insomniaFetch } from '../../ui/insomniaFetch';
import { invariant } from '../../utils/invariant';
import { AsyncTask, getInitialRouteForOrganization } from '../../utils/router';
import { SegmentEvent } from '../analytics';
import { getLoginUrl } from '../auth-session-provider';
import { Avatar } from '../components/avatar';
import { CommandPalette } from '../components/command-palette';
import { GitHubStarsButton } from '../components/github-stars-button';
import { Hotkey } from '../components/hotkey';
import { Icon } from '../components/icon';
import { InsomniaAI } from '../components/insomnia-ai-icon';
import { InsomniaLogo } from '../components/insomnia-icon';
import { showAlert, showModal } from '../components/modals';
import { SettingsModal, showSettingsModal } from '../components/modals/settings-modal';
import { OrganizationAvatar } from '../components/organization-avatar';
import { PresentUsers } from '../components/present-users';
import { Toast } from '../components/toast';
import { useAIContext } from '../context/app/ai-context';
import { InsomniaEventStreamProvider } from '../context/app/insomnia-event-stream-context';
import { syncProjects } from './project';
import { useRootLoaderData } from './root';
import type { UntrackedProjectsLoaderData } from './untracked-projects';
import type { WorkspaceLoaderData } from './workspace';

export interface OrganizationsResponse {
  start: number;
  limit: number;
  length: number;
  total: number;
  next: string;
  organizations: Organization[];
}

interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  picture: string;
  bio: string;
  github: string;
  linkedin: string;
  twitter: string;
  identities: any;
  given_name: string;
  family_name: string;
}

type PersonalPlanType = 'free' | 'individual' | 'team' | 'enterprise' | 'enterprise-member';
const formatCurrentPlanType = (type: PersonalPlanType) => {
  switch (type) {
    case 'free':
      return 'Free';
    case 'individual':
      return 'Individual';
    case 'team':
      return 'Team';
    case 'enterprise':
      return 'Enterprise';
    case 'enterprise-member':
      return 'Enterprise Member';
    default:
      return 'Free';
  }
};
type PaymentSchedules = 'month' | 'year';

interface CurrentPlan {
  isActive: boolean;
  period: PaymentSchedules;
  planId: string;
  price: number;
  quantity: number;
  type: PersonalPlanType;
};

function sortOrganizations(accountId: string, organizations: Organization[]): Organization[] {
  const home = organizations.find(organization => isPersonalOrganization(organization) && isOwnerOfOrganization({
    organization,
    accountId,
  }));
  const myOrgs = organizations.filter(organization => !isPersonalOrganization(organization) && isOwnerOfOrganization({
    organization,
    accountId,
  })).sort((a, b) => a.name.localeCompare(b.name));
  const notMyOrgs = organizations.filter(organization => !isOwnerOfOrganization({
    organization,
    accountId,
  })).sort((a, b) => a.name.localeCompare(b.name));
  return [
    ...(home ? [home] : []),
    ...myOrgs,
    ...notMyOrgs,
  ];
}

async function syncOrganizations(sessionId: string, accountId: string) {
  try {
    const [organizationsResult, user, currentPlan] = await Promise.all([
      insomniaFetch<OrganizationsResponse | void>({
        method: 'GET',
        path: '/v1/organizations',
        sessionId,
      }),
      insomniaFetch<UserProfileResponse | void>({
        method: 'GET',
        path: '/v1/user/profile',
        sessionId,
      }),
      insomniaFetch<CurrentPlan | void>({
        method: 'GET',
        path: '/v1/billing/current-plan',
        sessionId,
      }),
    ]);

    invariant(organizationsResult && organizationsResult.organizations, 'Failed to load organizations');
    invariant(user && user.id, 'Failed to load user');
    invariant(currentPlan && currentPlan.planId, 'Failed to load current plan');

    const { organizations } = organizationsResult;

    invariant(accountId, 'Account ID is not defined');

    localStorage.setItem(`${accountId}:organizations`, JSON.stringify(sortOrganizations(accountId, organizations)));
    localStorage.setItem(`${accountId}:user`, JSON.stringify(user));
    localStorage.setItem(`${accountId}:currentPlan`, JSON.stringify(currentPlan));
  } catch (error) {
    console.log('[organization] Failed to load Organizations', error);
  }
}

interface SyncOrgsAndProjectsActionRequest {
  organizationId: string;
  asyncTaskList: AsyncTask[];
  projectId?: string;
}

// this action is used to run task that we dont want to block the UI
export const syncOrgsAndProjectsAction: ActionFunction = async ({ request }) => {
  try {
    const { organizationId, projectId, asyncTaskList } = await request.json() as SyncOrgsAndProjectsActionRequest;
    const { id: sessionId, accountId } = await userSession.getOrCreate();

    const taskPromiseList = [];
    if (asyncTaskList.includes(AsyncTask.SyncOrganization)) {
      invariant(sessionId, 'sessionId is required');
      invariant(accountId, 'accountId is required');
      taskPromiseList.push(syncOrganizations(sessionId, accountId));
    }

    if (asyncTaskList.includes(AsyncTask.MigrateProjects)) {
      const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
      invariant(organizations, 'Failed to fetch organizations.');
      const personalOrganization = findPersonalOrganization(organizations, accountId);
      invariant(personalOrganization, 'personalOrganization is required');
      invariant(personalOrganization.id, 'personalOrganizationId is required');
      invariant(sessionId, 'sessionId is required');
      taskPromiseList.push(migrateProjectsUnderOrganization(personalOrganization.id, sessionId));
    }

    if (asyncTaskList.includes(AsyncTask.SyncProjects)) {
      invariant(organizationId, 'organizationId is required');
      taskPromiseList.push(syncProjects(organizationId));
    }

    await Promise.all(taskPromiseList);

    // When user switch to a new organization, there is no project in db cache, we need to redirect to the first project after sync project
    if (!projectId && asyncTaskList.includes(AsyncTask.SyncProjects)) {
      const firstProject = await database.getWhere<Project>(ProjectType, { parentId: organizationId });
      if (firstProject?._id) {
        return redirect(`/organization/${organizationId}/project/${firstProject?._id}`);
      }
    }

    return {};
  } catch (error) {
    console.log('Failed to run async task', error);
    return {
      error: error.message,
    };
  }
};

async function migrateProjectsUnderOrganization(personalOrganizationId: string, sessionId: string) {
  if (await shouldMigrateProjectUnderOrganization()) {
    await migrateProjectsIntoOrganization({
      personalOrganizationId,
    });

    const preferredProjectType = localStorage.getItem('prefers-project-type');
    if (preferredProjectType === 'remote') {
      const localProjects = await database.find<Project>('Project', {
        parentId: personalOrganizationId,
        remoteId: null,
      });

      // If any of those fail projects will still be under the organization as local projects
      for (const project of localProjects) {
        updateLocalProjectToRemote({
          project,
          organizationId: personalOrganizationId,
          sessionId,
          vcs: VCSInstance(),
        });
      }
    }
  }
};

export const indexLoader: LoaderFunction = async () => {
  const { id: sessionId, accountId } = await userSession.getOrCreate();
  if (sessionId) {
    await syncOrganizations(sessionId, accountId);

    const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
    invariant(organizations, 'Failed to fetch organizations.');

    const personalOrganization = findPersonalOrganization(organizations, accountId);
    invariant(personalOrganization, 'Failed to find personal organization your account appears to be in an invalid state. Please contact support if this is a recurring issue.');
    const personalOrganizationId = personalOrganization.id;
    await migrateProjectsUnderOrganization(personalOrganizationId, sessionId);

    if (personalOrganization) {
      return redirect(`/organization/${personalOrganizationId}`);
    }

    if (organizations.length > 0) {
      return redirect(`/organization/${organizations[0].id}`);
    }
  }

  await session.logout();
  return redirect('/auth/login');
};

export const syncOrganizationsAction: ActionFunction = async () => {
  const { id: sessionId, accountId } = await userSession.getOrCreate();

  if (sessionId) {
    await syncOrganizations(sessionId, accountId);
  }

  return null;
};

export interface OrganizationLoaderData {
  organizations: Organization[];
  user?: UserProfileResponse;
  currentPlan?: CurrentPlan;
}

export const loader: LoaderFunction = async () => {
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
  } else {
    return {
      organizations: [],
      user: undefined,
      currentPlan: undefined,
    };
  }
};

export interface FeatureStatus {
  enabled: boolean;
  reason?: string;
}

export interface FeatureList {
  gitSync: FeatureStatus;
  orgBasicRbac: FeatureStatus;
}

export interface Billing {
  // If true, the user has paid for the current period
  isActive: boolean;
}

export interface StorageRule {
  storage: 'cloud_plus_local' | 'cloud_only' | 'local_only';
  isOverridden: boolean;
}

export interface OrganizationFeatureLoaderData {
  featuresPromise: Promise<FeatureList>;
  billingPromise: Promise<Billing>;
  storagePromise: Promise<'cloud_plus_local' | 'cloud_only' | 'local_only'>;
}

export const organizationPermissionsLoader: LoaderFunction = async ({ params }): Promise<OrganizationFeatureLoaderData> => {
  const { organizationId } = params as { organizationId: string };
  const { id: sessionId, accountId } = await userSession.getOrCreate();
  const fallbackFeatures = {
    gitSync: { enabled: false, reason: 'Insomnia API unreachable' },
    orgBasicRbac: { enabled: false, reason: 'Insomnia API unreachable' },
  };

  // If network unreachable assume user has paid for the current period
  const fallbackBilling = {
    isActive: true,
  };

  const fallbackStorage = 'cloud_plus_local';

  if (isScratchpadOrganizationId(organizationId)) {
    return {
      featuresPromise: Promise.resolve(fallbackFeatures),
      billingPromise: Promise.resolve(fallbackBilling),
      storagePromise: Promise.resolve(fallbackStorage),
    };
  }

  const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
  const organization = organizations.find(o => o.id === organizationId);

  if (!organization) {
    throw redirect('/organization');
  }

  try {
    const featuresResponse = insomniaFetch<{ features: FeatureList; billing: Billing } | undefined>({
      method: 'GET',
      path: `/v1/organizations/${organizationId}/features`,
      sessionId,
    });

    const ruleResponse = insomniaFetch<StorageRule | undefined>({
      method: 'GET',
      path: `/v1/organizations/${organizationId}/storage-rule`,
      sessionId,
    });
    return {
      featuresPromise: featuresResponse.then(res => res?.features || fallbackFeatures),
      billingPromise: featuresResponse.then(res => res?.billing || fallbackBilling),
      storagePromise: ruleResponse.then(res => res?.storage || fallbackStorage),
    };
  } catch (err) {
    return {
      featuresPromise: Promise.resolve(fallbackFeatures),
      billingPromise: Promise.resolve(fallbackBilling),
      storagePromise: Promise.resolve(fallbackStorage),
    };
  }
};

export const useOrganizationLoaderData = () => {
  return useRouteLoaderData('/organization') as OrganizationLoaderData;
};

const UpgradeButton = ({
  currentPlan,
}: {
  currentPlan: CurrentPlan;
}) => {

  // For the enterprise-member plan we don't show the upgrade button.
  if (currentPlan?.type === 'enterprise-member') {
    return null;
  }

  // If user has a team or enterprise plan we navigate them to the Enterprise contact page.
  if (['team', 'enterprise'].includes(currentPlan?.type || '')) {
    return (
      <a
        className="px-4 text-[--color-font] hover:bg-[--hl-xs] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        href={'https://insomnia.rest/pricing/contact'}
      >
        {currentPlan?.type === 'enterprise' ? '+ Add more seats' : 'Upgrade'}
      </a>
    );
  }

  let to = '/app/subscription/update?plan=individual&pay_schedule=year';

  if (currentPlan?.type === 'individual') {
    to = `/app/subscription/update?plan=team&pay_schedule=${currentPlan?.period}`;
  }

  return (
    <a
      href={getAppWebsiteBaseURL() + to}
      className="px-4 text-[--color-font] hover:bg-[--hl-xs] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
    >
      Upgrade
    </a>
  );
};

const OrganizationRoute = () => {
  const { userSession, settings } = useRootLoaderData();

  const { organizations, user, currentPlan } =
    useLoaderData() as OrganizationLoaderData;
  const workspaceData = useRouteLoaderData(
    ':workspaceId',
  ) as WorkspaceLoaderData | null;
  const logoutFetcher = useFetcher();
  const navigate = useNavigate();
  const [isScratchPadBannerDismissed, setIsScratchPadBannerDismissed] = useLocalStorage('scratchpad-banner-dismissed', '');
  const isScratchpadWorkspace =
    workspaceData?.activeWorkspace &&
    isScratchpad(workspaceData.activeWorkspace);
  const isScratchPadBannerVisible = !isScratchPadBannerDismissed && isScratchpadWorkspace;
  const untrackedProjectsFetcher = useFetcher<UntrackedProjectsLoaderData>();
  const { organizationId, projectId, workspaceId } = useParams() as {
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

    submit({
      organizationId,
      projectId: projectId || '',
      asyncTaskList,
    }, {
      action: '/organization/sync-orgs-and-projects',
      method: 'POST',
      encType: 'application/json',
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
      untrackedProjectsFetcher.load('/untracked-projects');
    }
  }, [untrackedProjectsFetcher, organizationId]);

  const untrackedProjects = untrackedProjectsFetcher.data?.untrackedProjects || [];
  const untrackedWorkspaces = untrackedProjectsFetcher.data?.untrackedWorkspaces || [];
  const hasUntrackedData = untrackedProjects.length > 0 || untrackedWorkspaces.length > 0;
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

  const [isOrganizationSidebarOpen, setIsOganizationSidebarOpen] = useLocalStorage('organizationSidebarOpen', true);

  const {
    generating: loadingAI,
    progress: loadingAIProgress,
  } = useAIContext();

  return (
    <InsomniaEventStreamProvider>
      <div className="w-full h-full">
        <div className={`w-full h-full divide-x divide-solid divide-[--hl-md] ${isOrganizationSidebarOpen ? 'with-navbar' : ''} ${isScratchPadBannerVisible ? 'with-banner' : ''} grid-template-app-layout grid relative bg-[--color-bg]`}>
          <header className="[grid-area:Header] grid grid-cols-3 items-center border-b border-solid border-[--hl-md]">
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 w-[50px] justify-center py-2">
                <InsomniaLogo loading={loadingAI} />
              </div>
              <CommandPalette />
              {!user ? <GitHubStarsButton /> : null}
            </div>
            <div className="flex place-content-stretch gap-2 flex-nowrap items-center justify-center">
              {workspaceData && isDesign(workspaceData?.activeWorkspace) && (
                <nav className="flex rounded-full justify-between content-evenly font-semibold bg-[--hl-xs] p-[--padding-xxs]">
                  {[
                    { id: 'spec', name: 'spec' },
                    { name: 'collection', id: 'debug' },
                    { id: 'test', name: 'tests' },
                  ].map(item => (
                    <NavLink
                      key={item.id}
                      to={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${item.id}`}
                      className={({ isActive, isPending }) =>
                        `${isActive
                          ? 'text-[--color-font] bg-[--color-bg]'
                          : ''
                        } ${isPending ? 'animate-pulse' : ''} no-underline transition-colors text-center outline-none min-w-[4rem] uppercase text-[--color-font] text-xs px-[--padding-xs] py-[--padding-xxs] rounded-full`
                      }
                      data-testid={`workspace-${item.id}`}
                    >
                      {item.name}
                    </NavLink>
                  ))}
                </nav>
              )}
            </div>
            <div className="flex gap-[--padding-sm] items-center justify-end p-2">
              {user ? (
                <Fragment>
                  <PresentUsers />
                  <Button
                    aria-label="Invite collaborators"
                    className="px-4 text-[--color-font-surprise] bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] py-2 h-full font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-md hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    onPress={() => {
                      window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/dashboard/organizations/${organizationId}/collaborators`);
                      window.main.trackSegmentEvent({ event: SegmentEvent.inviteTrigger });
                    }}
                  >
                    <Icon icon="user-plus" />
                    <span className="truncate">
                      Invite
                    </span>
                  </Button>
                  <MenuTrigger>
                    <Button data-testid='user-dropdown' className="px-1 py-1 flex-shrink-0 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                      <Avatar
                        src={user.picture}
                        alt={user.name}
                      />
                      <span className="truncate">
                        {user.name}
                      </span>
                      <Icon className='w-4 pr-2' icon="caret-down" />
                    </Button>
                    <Popover className="min-w-max border select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none">
                      {currentPlan && Boolean(currentPlan.type) && (
                        <div className='flex gap-2 justify-between items-center pb-2 px-[--padding-md] border-b border-solid border-[--hl-sm] text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap'>
                          <span>{formatCurrentPlanType(currentPlan.type)} Plan</span>
                          <UpgradeButton currentPlan={currentPlan} />
                        </div>
                      )}
                      <Menu
                        className='focus:outline-none'
                        onAction={action => {
                          if (action === 'logout') {
                            logoutFetcher.submit(
                              {},
                              {
                                action: '/auth/logout',
                                method: 'POST',
                              },
                            );
                          }

                          if (action === 'account-settings') {
                            window.main.openInBrowser(
                              `${getAppWebsiteBaseURL()}/app/settings/account`,
                            );
                          }

                          if (action === 'manage-organizations') {
                            window.main.openInBrowser(
                              `${getAppWebsiteBaseURL()}/app/dashboard/organizations`
                            );
                          }
                        }}
                      >
                        <MenuItem
                          id="manage-organizations"
                          className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                          aria-label="Manage organizations"
                        >
                          <Icon icon="users" />
                          <span>Manage Organizations</span>
                        </MenuItem>
                        <MenuItem
                          id="account-settings"
                          className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                          aria-label="Account settings"
                        >
                          <Icon icon="gear" />
                          <span>Account Settings</span>
                        </MenuItem>
                        <MenuItem
                          id="logout"
                          className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                          aria-label="logout"
                        >
                          <Icon icon="sign-out" />
                          <span>Log out</span>
                        </MenuItem>
                      </Menu>
                    </Popover>
                  </MenuTrigger>
                </Fragment>
              ) : (
                <Fragment>
                  <NavLink
                    to="/auth/login"
                    className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    Login
                  </NavLink>
                  <NavLink
                    className="px-4 py-1 flex items-center justify-center gap-2 aria-pressed:bg-[rgba(var(--color-surprise-rgb),0.8)] focus:bg-[rgba(var(--color-surprise-rgb),0.9)] bg-[--color-surprise] font-semibold rounded-sm text-[--color-font-surprise] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    to="/auth/login"
                  >
                      Sign up for free
                  </NavLink>
                </Fragment>
              )}
            </div>
          </header>
          {isScratchPadBannerVisible ? (
            <div className="flex h-[30px] items-center [grid-area:Banner] text-white bg-gradient-to-r from-[#7400e1] to-[#4000bf]">
              <div className="flex flex-shrink-0 basis-[50px] h-full">
                <div className="border-solid border-r-[--hl-xl] border-r border-l border-l-[--hl-xl] box-border flex items-center justify-center w-full h-full">
                  <Icon icon="edit" />
                </div>
              </div>
              <div className="py-[--padding-xs] overflow-hidden px-[--padding-md] w-full h-full flex items-center text-xs">
                <p className='w-full truncate leading-normal'>
                  Welcome to the Scratch Pad where you can work locally with up to 1 collection.
                  To create more and see your projects
                  {' '}
                  <NavLink
                    to="/auth/login"
                    className="font-bold text-white inline-flex"
                  >
                    login or create an account →
                  </NavLink>
                </p>
              </div>
              <Button
                className="flex flex-shrink-0 mr-2 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                onPress={() => {
                  setIsScratchPadBannerDismissed('true');
                }}
              >
                <Icon icon="x" />
              </Button>
            </div>
          ) : null}
          {isOrganizationSidebarOpen && <div className={`[grid-area:Navbar] overflow-hidden ${isOrganizationSidebarOpen ? '' : 'hidden'}`}>
            <nav className="flex flex-col items-center place-content-stretch gap-[--padding-md] w-full h-full overflow-y-auto py-[--padding-md]">
              {organizations.map(organization => {
                const isActive = organization.id === organizationId;
                return (
                  <TooltipTrigger key={organization.id}>
                    <Link className="outline-none">
                      <div
                        className={`select-none text-[--color-font-surprise] hover:no-underline transition-all duration-150 bg-gradient-to-br box-border from-[#4000BF] to-[#154B62] font-bold outline-[3px] rounded-md w-[28px] h-[28px] flex items-center justify-center active:outline overflow-hidden outline-offset-[3px] outline ${isActive
                          ? 'outline-[--color-font]'
                          : 'outline-transparent focus:outline-[--hl-md] hover:outline-[--hl-md]'
                          }`}
                        onClick={async () => {
                          const routeForOrganization = await getInitialRouteForOrganization(organization.id);
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
                        {isPersonalOrganization(organization) && isOwnerOfOrganization({
                          organization,
                          accountId: userSession.accountId || '',
                        }) ? (
                          <Icon icon="home" />
                        ) : (
                          <OrganizationAvatar
                            alt={organization.display_name}
                            src={organization.branding?.logo_url || ''}
                          />
                        )}
                      </div>
                    </Link>
                    <Tooltip
                      placement="right"
                      offset={8}
                      className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                    >
                      <span>{organization.display_name}</span>
                    </Tooltip>
                  </TooltipTrigger>
                );
              })}
              <MenuTrigger>
                <Button className="select-none text-[--color-font] hover:no-underline transition-all duration-150 box-border p-[--padding-sm] font-bold outline-none rounded-md w-[28px] h-[28px] flex items-center justify-center overflow-hidden">
                  <Icon icon="plus" />
                </Button>
                <Popover placement="left" className="min-w-max">
                  <Menu
                    onAction={action => {
                      if (action === 'join-organization') {
                        window.main.openInBrowser(
                          getLoginUrl(),
                        );
                      }

                      if (action === 'new-organization') {
                        if (currentPlan?.type !== 'enterprise-member') {
                          window.main.openInBrowser(
                            `${getAppWebsiteBaseURL()}/app/organization/create`,
                          );
                        } else {
                          showAlert({
                            title: 'Could not create new organization.',
                            message: 'Your Insomnia account is tied to the enterprise corporate account. Please ask the owner of the enterprise billing to create one for you.',
                          });
                        }
                      }
                    }}
                    className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    <MenuItem
                      id="join-organization"
                      className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                      aria-label="Join an organization"
                    >
                      <Icon icon="city" />
                      <span>Join an organization</span>
                    </MenuItem>
                    <MenuItem
                      id="new-organization"
                      className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                      aria-label="Create new organization"
                    >
                      <Icon icon="sign-out" />
                      <span>Create a new organization</span>
                    </MenuItem>
                  </Menu>
                </Popover>
              </MenuTrigger>
            </nav>
          </div>}
          <div className='[grid-area:Content] overflow-hidden border-b border-[--hl-md]'>
            <Outlet />
          </div>
          <div className="relative [grid-area:Statusbar] flex items-center overflow-hidden">
            <TooltipTrigger>
              <ToggleButton
                className="w-[50px] flex-shrink-0 px-4 py-1 border-solid border-r border-r-[--hl-md] h-full flex items-center justify-center gap-2 text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
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
                className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                Toggle organizations sidebar
              </Tooltip>
            </TooltipTrigger>
            <div className='flex w-full h-full items-center justify-between'>
              <div className="flex h-full">
                <TooltipTrigger>
                  <Button
                    data-testid="settings-button"
                    className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                    onPress={() => showSettingsModal()}
                  >
                    <Icon icon="gear" /> Preferences
                  </Button>
                  <Tooltip
                    placement="top"
                    offset={8}
                    className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    Preferences
                    <Hotkey
                      keyBindings={
                        settings.hotKeyRegistry.preferences_showGeneral
                      }
                    />
                  </Tooltip>
                </TooltipTrigger>
                {hasUntrackedData ? <div>
                  <Button
                    className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-warning] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                    onPress={() => showModal(SettingsModal, { tab: 'data' })}
                  >
                    <Icon icon="exclamation-circle" /> We have detected orphaned projects on your computer, click here to view them.
                  </Button>
                </div> : null}
              </div>
              <div className='flex items-center gap-2 divide divide-y-[--hl-sm]'>
                {loadingAI && (
                  <ProgressBar
                    className="flex items-center gap-2 h-full"
                    value={loadingAIProgress.progress}
                    maxValue={loadingAIProgress.total}
                    minValue={0}
                    aria-label='AI generation'
                  >
                    {({ percentage }) => (
                      <TooltipTrigger>
                        <Button className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all">
                          <InsomniaAI className='w-4 text-[--color-font] animate-pulse' />
                          <div className="h-1 w-32 rounded-full bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-40">
                            <div
                              className="h-1 rounded-full bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100"
                              style={{ width: percentage + '%' }}
                            />
                          </div>
                        </Button>
                        <Tooltip
                          placement="top"
                          offset={8}
                          className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                        >
                          Generating tests with Insomnia AI
                        </Tooltip>
                      </TooltipTrigger>
                    )}
                  </ProgressBar>
                )}
                {/* The sync indicator only show when network status is online */}
                {/* use for show sync organization and projects status(1. first enter app 2. switch organization) */}
                {status === 'online' && asyncTaskStatus !== 'idle' ? (
                  <TooltipTrigger>
                    <Button
                      className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                      onPress={() => {
                        asyncTaskStatus === 'error' && syncOrgsAndProjects();
                      }}
                    >
                      <Icon
                        icon={asyncTaskStatus !== 'error' ? 'spinner' : 'circle'}
                        className={`${asyncTaskStatus === 'error' ? 'text-[--color-danger]' : 'text-[--color-success]'} w-5 ${asyncTaskStatus !== 'error' ? 'animate-spin' : ''}`}
                      />
                      {asyncTaskStatus !== 'error' ? 'Syncing' : 'Sync error: click to retry'}
                    </Button>
                    <Tooltip
                      placement="top"
                      offset={8}
                      className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                    >
                      {asyncTaskStatus !== 'error' ? 'Syncing' : 'Sync error: click to retry'}
                    </Tooltip>
                  </TooltipTrigger>
                ) : (
                    <TooltipTrigger>
                  <Button
                    className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
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
                      className={
                        user
                          ? status === 'online'
                            ? 'text-[--color-success]'
                            : 'text-[--color-danger]'
                          : ''
                      }
                    />{' '}
                    {user
                      ? status.charAt(0).toUpperCase() + status.slice(1)
                      : 'Log in to see your projects'}
                    {status === 'online' && settings.proxyEnabled ? ' via proxy' : ''}
                  </Button>
                  <Tooltip
                    placement="top"
                    offset={8}
                    className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    {user
                      ? status === 'online' ? 'You have connectivity to the Internet' + (settings.proxyEnabled ? ' via the configured proxy' : '') + '.'
                        : 'You are offline. Connect to sync your data.'
                      : 'Log in to Insomnia to unlock the full product experience.'}
                  </Tooltip>
                </TooltipTrigger>
                )}
                <span className='w-[1px] h-full bg-[--hl-sm]' />
                <Link>
                  <a
                    className="flex focus:outline-none focus:underline gap-1 items-center text-xs text-[--color-font] px-[--padding-md]"
                    href="https://konghq.com/"
                  >
                    Made with
                    <Icon className="text-[--color-surprise-font]" icon="heart" /> by
                    Kong
                  </a>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Toast />
      </div>
    </InsomniaEventStreamProvider>
  );
};

export default OrganizationRoute;
