import React, { Fragment, useEffect, useState } from 'react';
import {
  Button,
  Link,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  ProgressBar,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import {
  ActionFunction,
  LoaderFunction,
  NavLink,
  Outlet,
  redirect,
  ShouldRevalidateFunction,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import * as session from '../../account/session';
import {
  getAccountId,
  getCurrentSessionId,
} from '../../account/session';
import { getAppWebsiteBaseURL } from '../../common/constants';
import { database } from '../../common/database';
import { updateLocalProjectToRemote } from '../../models/helpers/project';
import { isOwnerOfOrganization, isPersonalOrganization, isScratchpadOrganizationId, Organization } from '../../models/organization';
import { Project } from '../../models/project';
import { isDesign, isScratchpad } from '../../models/workspace';
import { VCSInstance } from '../../sync/vcs/insomnia-sync';
import { migrateProjectsIntoOrganization, shouldMigrateProjectUnderOrganization } from '../../sync/vcs/migrate-projects-into-organization';
import { invariant } from '../../utils/invariant';
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
import { useRootLoaderData } from './root';
import { UntrackedProjectsLoaderData } from './untracked-projects';
import { WorkspaceLoaderData } from './workspace';

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

export const organizationsData: OrganizationLoaderData = {
  organizations: [],
  user: undefined,
  currentPlan: undefined,
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

export const indexLoader: LoaderFunction = async () => {
  const sessionId = getCurrentSessionId();
  if (sessionId) {
    try {
      const organizationsResult = await window.main.insomniaFetch<OrganizationsResponse | void>({
        method: 'GET',
        path: '/v1/organizations',
        sessionId,
      });

      const user = await window.main.insomniaFetch<UserProfileResponse | void>({
        method: 'GET',
        path: '/v1/user/profile',
        sessionId,
      });

      const currentPlan = await window.main.insomniaFetch<CurrentPlan | void>({
        method: 'GET',
        path: '/v1/billing/current-plan',
        sessionId,
      });

      invariant(organizationsResult && organizationsResult.organizations, 'Failed to load organizations');
      invariant(user && user.id, 'Failed to load user');
      invariant(currentPlan && currentPlan.planId, 'Failed to load current plan');

      const { organizations } = organizationsResult;

      const accountId = getAccountId();
      invariant(accountId, 'Account ID is not defined');
      organizationsData.organizations = sortOrganizations(accountId, organizations);
      organizationsData.user = user;
      organizationsData.currentPlan = currentPlan;
      const personalOrganization = organizations.filter(isPersonalOrganization)
        .find(organization =>
          isOwnerOfOrganization({
            organization,
            accountId,
          }));
      invariant(personalOrganization, 'Failed to find personal organization your account appears to be in an invalid state. Please contact support if this is a recurring issue.');
      if (await shouldMigrateProjectUnderOrganization()) {
        await migrateProjectsIntoOrganization({
          personalOrganization,
        });

        const preferredProjectType = localStorage.getItem('prefers-project-type');
        if (preferredProjectType === 'remote') {
          const localProjects = await database.find<Project>('Project', {
            parentId: personalOrganization.id,
            remoteId: null,
          });

          // If any of those fail projects will still be under the organization as local projects
          for (const project of localProjects) {
            updateLocalProjectToRemote({
              project,
              organizationId: personalOrganization.id,
              sessionId,
              vcs: VCSInstance(),
            });
          }
        }
      }

      if (personalOrganization) {
        return redirect(`/organization/${personalOrganization.id}`);
      }

      if (organizations.length > 0) {
        return redirect(`/organization/${organizations[0].id}`);
      }
    } catch (error) {
      console.log('Failed to load Organizations', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Network connectivity issue: Failed to load Organizations. ${errorMessage}`);
    }
  }

  await session.logout();
  return redirect('/auth/login');
};

export const syncOrganizationsAction: ActionFunction = async () => {
  const sessionId = getCurrentSessionId();
  if (sessionId) {
    try {

      const organizationsResult = await window.main.insomniaFetch<OrganizationsResponse | void>({
        method: 'GET',
        path: '/v1/organizations',
        sessionId,
      });

      const user = await window.main.insomniaFetch<UserProfileResponse | void>({
        method: 'GET',
        path: '/v1/user/profile',
        sessionId,
      });

      const currentPlan = await window.main.insomniaFetch<CurrentPlan | void>({
        method: 'GET',
        path: '/v1/billing/current-plan',
        sessionId,
      });

      invariant(organizationsResult, 'Failed to load organizations');
      invariant(user, 'Failed to load user');
      invariant(currentPlan, 'Failed to load current plan');
      const accountId = getAccountId();
      invariant(accountId, 'Account ID is not defined');
      organizationsData.organizations = sortOrganizations(accountId, organizationsResult.organizations);
      organizationsData.user = user;
      organizationsData.currentPlan = currentPlan;
    } catch (error) {
      console.log('Failed to load Organizations', error);
    }
  }

  return null;
};

export interface OrganizationLoaderData {
  organizations: Organization[];
  user?: UserProfileResponse;
  currentPlan?: CurrentPlan;
}

export const loader: LoaderFunction = async () => {
  if (session.isLoggedIn()) {
    return organizationsData;
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

export const singleOrgLoader: LoaderFunction = async ({ params }) => {
  const { organizationId } = params as { organizationId: string };

  const fallbackFeatures = {
    gitSync: { enabled: false, reason: 'Insomnia API unreachable' },
    orgBasicRbac: { enabled: false, reason: 'Insomnia API unreachable' },
  };

  // If network unreachable assume user has paid for the current period
  const fallbackBilling = {
    isActive: true,
  };

  if (isScratchpadOrganizationId(organizationId)) {
    return {
      features: fallbackFeatures,
      billing: fallbackBilling,
    };
  }

  const organization = organizationsData.organizations.find(o => o.id === organizationId);

  if (!organization) {
    return redirect('/organization');
  }

  try {
    const response = await window.main.insomniaFetch<{ features: FeatureList; billing: Billing } | undefined>({
      method: 'GET',
      path: `/v1/organizations/${organizationId}/features`,
      sessionId: session.getCurrentSessionId(),
    });

    return {
      features: response?.features || fallbackFeatures,
      billing: response?.billing || fallbackBilling,
    };
  } catch (err) {
    return {
      features: fallbackFeatures,
      billing: fallbackBilling,
    };
  }
};

export const useOrganizationLoaderData = () => {
  return useRouteLoaderData('/organization') as OrganizationLoaderData;
};

export const shouldOrganizationsRevalidate: ShouldRevalidateFunction = ({
  currentParams,
  nextParams,
}) => {
  const isSwitchingBetweenOrganizations = currentParams.organizationId !== nextParams.organizationId;

  return isSwitchingBetweenOrganizations;
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
  const { settings } = useRootLoaderData();

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
  const [status, setStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    const isIdleAndUninitialized = untrackedProjectsFetcher.state === 'idle' && !untrackedProjectsFetcher.data;
    if (isIdleAndUninitialized) {
      untrackedProjectsFetcher.load('/untracked-projects');
    }
  }, [untrackedProjectsFetcher, organizationId]);

  const untrackedProjects = untrackedProjectsFetcher.data?.untrackedProjects || [];
  const untrackedWorkspaces = untrackedProjectsFetcher.data?.untrackedWorkspaces || [];
  const hasUntrackedData = untrackedProjects.length > 0 || untrackedWorkspaces.length > 0;

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

  const {
    generating: loadingAI,
    progress: loadingAIProgress,
  } = useAIContext();

  return (
    <InsomniaEventStreamProvider>
      <div className="w-full h-full">
        <div className={`w-full h-full divide-x divide-solid divide-y divide-[--hl-md] ${isScratchPadBannerVisible ? 'grid-template-app-layout-with-banner' : 'grid-template-app-layout'} grid relative bg-[--color-bg]`}>
          <header className="[grid-area:Header] grid grid-cols-3 items-center">
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
                    Sign Up
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
          <div className="[grid-area:Navbar]">
            <nav className="flex flex-col items-center place-content-stretch gap-[--padding-md] w-full h-full overflow-y-auto py-[--padding-md]">
              {organizations.map(organization => (
                <TooltipTrigger key={organization.id}>
                  <Link className="outline-none">
                    <NavLink
                      className={({ isActive, isPending }) =>
                        `select-none text-[--color-font-surprise] hover:no-underline transition-all duration-150 bg-gradient-to-br box-border from-[#4000BF] to-[#154B62] font-bold outline-[3px] rounded-md w-[28px] h-[28px] flex items-center justify-center active:outline overflow-hidden outline-offset-[3px] outline ${isActive
                          ? 'outline-[--color-font]'
                          : 'outline-transparent focus:outline-[--hl-md] hover:outline-[--hl-md]'
                        } ${isPending ? 'animate-pulse' : ''}`
                      }
                      to={`/organization/${organization.id}`}
                    >
                      {isPersonalOrganization(organization) && isOwnerOfOrganization({
                        organization,
                        accountId: getAccountId() || '',
                      }) ? (
                        <Icon icon="home" />
                      ) : (
                        <OrganizationAvatar
                          alt={organization.display_name}
                          src={organization.branding?.logo_url || ''}
                        />
                      )}
                    </NavLink>
                  </Link>
                  <Tooltip
                    placement="right"
                    offset={8}
                    className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                  >
                    <span>{organization.display_name}</span>
                  </Tooltip>
                </TooltipTrigger>
              ))}
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
          </div>
          <Outlet />
          <div className="relative [grid-area:Statusbar] flex items-center justify-between overflow-hidden">
            <div className="flex h-full">
              <TooltipTrigger>
                <Button
                  data-testid="settings-button"
                  className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                  onPress={showSettingsModal}
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
              <TooltipTrigger>
                <Button
                  className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                  onPress={() => {
                    !user && navigate('/auth/login');
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
                </Button>
                <Tooltip
                  placement="top"
                  offset={8}
                  className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                >
                  {user
                    ? `You are ${status === 'online'
                      ? 'securely connected to Insomnia Cloud.'
                      : 'offline. Connect to sync your data.'
                    }`
                    : 'Log in to Insomnia to sync your data.'}
                </Tooltip>
              </TooltipTrigger>
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
        <Toast />
      </div>
    </InsomniaEventStreamProvider>
  );
};

export default OrganizationRoute;
