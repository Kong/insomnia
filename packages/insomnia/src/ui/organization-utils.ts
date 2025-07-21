import { database } from '../common/database';
import { userSession } from '../models';
import { updateLocalProjectToRemote } from '../models/helpers/project';
import type { Organization } from '../models/organization';
import { isOwnerOfOrganization, isPersonalOrganization, isScratchpadOrganizationId } from '../models/organization';
import type { Project } from '../models/project';
import { VCSInstance } from '../sync/vcs/insomnia-sync';
import {
  migrateProjectsIntoOrganization,
  shouldMigrateProjectUnderOrganization,
} from '../sync/vcs/migrate-projects-into-organization';
import { insomniaFetch } from '../ui/insomniaFetch';
import { invariant } from '../utils/invariant';

// Create an in-memory storage to store the storage rules
const inMemoryStorageRuleCache: Map<string, StorageRules> = new Map<string, StorageRules>();

export interface OrganizationsResponse {
  start: number;
  limit: number;
  length: number;
  total: number;
  next: string;
  organizations: Organization[];
}

export interface UserProfileResponse {
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

export type PersonalPlanType = 'free' | 'individual' | 'team' | 'enterprise' | 'enterprise-member';
export const formatCurrentPlanType = (type: PersonalPlanType) => {
  switch (type) {
    case 'free': {
      return 'Hobby';
    }
    case 'individual': {
      return 'Individual';
    }
    case 'team': {
      return 'Pro';
    }
    case 'enterprise': {
      return 'Enterprise';
    }
    case 'enterprise-member': {
      return 'Enterprise Member';
    }
    default: {
      return 'Free';
    }
  }
};
type PaymentSchedules = 'month' | 'year';

export interface CurrentPlan {
  isActive: boolean;
  period: PaymentSchedules;
  planId: string;
  price: number;
  quantity: number;
  type: PersonalPlanType;
  planName: string;
}

export function sortOrganizations(accountId: string, organizations: Organization[]): Organization[] {
  const home = organizations.find(
    organization =>
      isPersonalOrganization(organization) &&
      isOwnerOfOrganization({
        organization,
        accountId,
      }),
  );
  const myOrgs = organizations
    .filter(
      organization =>
        !isPersonalOrganization(organization) &&
        isOwnerOfOrganization({
          organization,
          accountId,
        }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const notMyOrgs = organizations
    .filter(
      organization =>
        !isOwnerOfOrganization({
          organization,
          accountId,
        }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...(home ? [home] : []), ...myOrgs, ...notMyOrgs];
}

export async function syncOrganizations(sessionId: string, accountId: string) {
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

export async function migrateProjectsUnderOrganization(personalOrganizationId: string, sessionId: string) {
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
}

export const DEFAULT_STORAGE_RULES = {
  enableCloudSync: true,
  enableLocalVault: true,
  enableGitSync: true,
  isOverridden: false,
};

export interface StorageRules {
  enableCloudSync: boolean;
  enableLocalVault: boolean;
  enableGitSync: boolean;
  isOverridden: boolean;
}
export async function fetchAndCacheOrganizationStorageRule(
  organizationId: string | undefined,
  forceFetch = false,
): Promise<StorageRules> {
  invariant(organizationId, 'Organization ID is required');

  if (isScratchpadOrganizationId(organizationId)) {
    return {
      enableCloudSync: false,
      enableLocalVault: true,
      enableGitSync: false,
      isOverridden: false,
    };
  }
  if (!forceFetch) {
    const storageRules = inMemoryStorageRuleCache.get(organizationId);
    if (storageRules) {
      return storageRules;
    }
  }
  const { id: sessionId } = await userSession.getOrCreate();

  // Otherwise fetch from the API
  return await insomniaFetch<StorageRules>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/storage-rule`,
    sessionId,
    onlyResolveOnSuccess: true,
  }).then(
    res => {
      if (res) {
        inMemoryStorageRuleCache.set(organizationId, res);
      }
      return res || DEFAULT_STORAGE_RULES;
    },
    err => {
      console.log('[storageRule] Failed to load storage rules', err.message);
      return DEFAULT_STORAGE_RULES;
    },
  );
}
