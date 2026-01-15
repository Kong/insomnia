import { type CurrentPlan, getCurrentPlan, getUserProfile } from 'insomnia-api';

import { projectLock } from '~/common/project';

import { database } from '../common/database';
import { project, userSession } from '../models';
import { updateLocalProjectToRemote } from '../models/helpers/project';
import type { Organization, OrganizationsResponse, StorageRules } from '../models/organization';
import { isOwnerOfOrganization, isPersonalOrganization, isScratchpadOrganizationId } from '../models/organization';
import type { Project } from '../models/project';
import { VCSInstance } from '../sync/vcs/insomnia-sync';
import {
  migrateProjectsIntoOrganization,
  shouldMigrateProjectUnderOrganization,
} from '../sync/vcs/migrate-projects-into-organization';
import { invariant } from '../utils/invariant';
import { insomniaFetch } from './insomnia-fetch';

// Create an in-memory storage to store the storage rules
const inMemoryStorageRuleCache: Map<string, StorageRules> = new Map<string, StorageRules>();

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

export async function syncCurrentPlan(sessionId: string, accountId: string) {
  const [currentPlanResult] = await Promise.allSettled([
    insomniaFetch<CurrentPlan | void>({
      method: 'GET',
      path: '/v1/billing/current-plan',
      sessionId,
    }),
  ]);
  if (currentPlanResult.status === 'fulfilled' && currentPlanResult.value) {
    localStorage.setItem(`${accountId}:currentPlan`, JSON.stringify(currentPlanResult.value));
  } else {
    console.log('[current-plan] Failed to load current-plan', currentPlanResult.status);
  }
}

export async function syncOrganizations(sessionId: string, accountId: string) {
  try {
    const [organizationsResult, user, currentPlan] = await Promise.all([
      insomniaFetch<OrganizationsResponse | void>({
        method: 'GET',
        path: '/v1/organizations',
        sessionId,
      }),
      getUserProfile({ sessionId }),
      getCurrentPlan({ sessionId }),
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

interface TeamProject {
  id: string;
  name: string;
}

async function getAllTeamProjects(organizationId: string) {
  const { id: sessionId } = await userSession.getOrCreate();
  if (!sessionId) {
    return [];
  }

  console.log('[project] Fetching', organizationId);
  const response = await insomniaFetch<{
    data: {
      id: string;
      name: string;
    }[];
  }>({
    path: `/v1/organizations/${organizationId}/team-projects`,
    method: 'GET',
    sessionId,
  });

  return response.data as TeamProject[];
}

async function syncTeamProjects({
  organizationId,
  teamProjects,
}: {
  teamProjects: TeamProject[];
  organizationId: string;
}) {
  // assumption: api teamProjects is the source of truth for migrated projects
  // once migrated orgs become the source of truth for projects
  // its important that migration be completed before this code is run
  const existingRemoteProjects = await database.find<Project>(project.type, {
    remoteId: { $in: teamProjects.map(p => p.id) },
  });

  const existingRemoteProjectsRemoteIds = existingRemoteProjects.map(p => p.remoteId);
  const remoteProjectsThatNeedToBeCreated = teamProjects.filter(p => !existingRemoteProjectsRemoteIds.includes(p.id));

  // this will create a new project for any remote projects that don't exist in the current organization
  await Promise.all(
    remoteProjectsThatNeedToBeCreated.map(async prj => {
      await project.create({
        remoteId: prj.id,
        name: prj.name,
        parentId: organizationId,
      });
    }),
  );

  const remoteProjectsThatNeedToBeUpdated = await database.find<Project>(project.type, {
    // Remote ID is in the list of remote projects
    remoteId: { $in: teamProjects.map(p => p.id) },
  });

  await Promise.all(
    remoteProjectsThatNeedToBeUpdated.map(async prj => {
      const remoteProject = teamProjects.find(p => p.id === prj.remoteId);
      if (remoteProject && remoteProject.name !== prj.name) {
        await project.update(prj, {
          name: remoteProject.name,
        });
      }
    }),
  );

  // Turn remote projects from the current organization that are not in the list of remote projects into local projects.
  const removedRemoteProjects = await database.find<Project>(project.type, {
    // filter by this organization so no legacy data can be accidentally removed, because legacy had null parentId
    parentId: organizationId,
    // Remote ID is not in the list of remote projects.
    // add `$ne: null` condition because if remoteId is already null, we dont need to remove it again.
    // nedb use append-only format, all updates and deletes actually result in lines added
    remoteId: {
      $nin: teamProjects.map(p => p.id),
      $ne: null,
    },
  });

  await Promise.all(
    removedRemoteProjects.map(async prj => {
      await project.update(prj, {
        remoteId: null,
      });
    }),
  );
}

export const syncProjects = projectLock.wrapWithLock(async (organizationId: string) => {
  const user = await userSession.getOrCreate();
  const teamProjects = await getAllTeamProjects(organizationId);
  // ensure we don't sync projects in the wrong place
  if (Array.isArray(teamProjects) && user.id && !isScratchpadOrganizationId(organizationId)) {
    await syncTeamProjects({
      organizationId,
      teamProjects,
    });
  }
});
