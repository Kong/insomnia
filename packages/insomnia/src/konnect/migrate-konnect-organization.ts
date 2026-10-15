import type { Organization } from 'insomnia-api';
import type { Project } from 'insomnia-data';
import { models, services } from 'insomnia-data';

import { database } from '~/common/database';
import { projectLock } from '~/common/project';

export interface KonnectMigrationGroup {
  organizationId: string;
  organizationName: string;
  projectCount: number;
  workspaceCount: number;
}

export interface KonnectMigrationPlan {
  /** `auto` means a single source organization, `conflict` means the user has to choose one. */
  status: 'none' | 'auto' | 'conflict';
  groups: KonnectMigrationGroup[];
}

const lastSyncedAtKey = (organizationId: string) => `${organizationId}:konnect-last-synced-at`;

function readCachedOrganizations(accountId: string): Organization[] {
  try {
    return JSON.parse(localStorage.getItem(`${accountId}:spaces`) || '[]') as Organization[];
  } catch {
    return [];
  }
}

async function listMigratableKonnectProjects(accountId: string): Promise<{
  projects: Project[];
  organizationNameById: Map<string, string>;
}> {
  const organizationNameById = new Map(readCachedOrganizations(accountId).map(o => [o.id, o.name]));
  if (organizationNameById.size === 0) {
    return { projects: [], organizationNameById };
  }

  // Konnect projects parented to an organization this account does not belong to came from another
  // account sharing the same database; they are deliberately left alone.
  // `konnectControlPlaneId` is an optional key, so non-Konnect projects omit it entirely and NeDB's
  // `$ne: null` alone would match them.
  const projects = await services.project.list({
    konnectControlPlaneId: { $exists: true, $ne: null },
    parentId: { $in: [...organizationNameById.keys()] },
  });

  return { projects, organizationNameById };
}

export async function detectKonnectOrgMigration({ accountId }: { accountId: string }): Promise<KonnectMigrationPlan> {
  if (!accountId) {
    return { status: 'none', groups: [] };
  }

  const { projects, organizationNameById } = await listMigratableKonnectProjects(accountId);
  if (projects.length === 0) {
    return { status: 'none', groups: [] };
  }

  const projectsByOrganizationId = new Map<string, Project[]>();
  for (const project of projects) {
    projectsByOrganizationId.set(project.parentId, [
      ...(projectsByOrganizationId.get(project.parentId) ?? []),
      project,
    ]);
  }

  const groups: KonnectMigrationGroup[] = [];
  for (const [organizationId, organizationProjects] of projectsByOrganizationId) {
    const workspaceCounts = await Promise.all(
      organizationProjects.map(project => services.workspace.count({ parentId: project._id })),
    );
    groups.push({
      organizationId,
      organizationName: organizationNameById.get(organizationId) ?? organizationId,
      projectCount: organizationProjects.length,
      workspaceCount: workspaceCounts.reduce((total, count) => total + count, 0),
    });
  }

  groups.sort((a, b) => b.projectCount - a.projectCount || a.organizationName.localeCompare(b.organizationName));

  return { status: groups.length > 1 ? 'conflict' : 'auto', groups };
}

/**
 * Runs the migration only when there is exactly one source organization. The ambiguous case is
 * surfaced to the user instead, since it means discarding one organization's Konnect data.
 */
export async function migrateKonnectProjectsIfUnambiguous(accountId: string): Promise<KonnectMigrationPlan> {
  const plan = await detectKonnectOrgMigration({ accountId });
  if (plan.status === 'auto') {
    await runKonnectOrgMigration({ accountId, keepOrganizationId: plan.groups[0].organizationId });
    return { status: 'none', groups: [] };
  }
  return plan;
}

/**
 * Re-parents the chosen organization's Konnect projects onto the account-wide Konnect organization
 * and discards the rest. Idempotent: once nothing matches, `detectKonnectOrgMigration` returns
 * `none` and this is never called again.
 */
export async function runKonnectOrgMigration({
  accountId,
  keepOrganizationId,
}: {
  accountId: string;
  keepOrganizationId: string;
}): Promise<void> {
  if (!accountId) {
    return;
  }
  const konnectOrganizationId = models.organization.getKonnectOrganizationId(accountId);

  await projectLock.lock();
  try {
    const { projects } = await listMigratableKonnectProjects(accountId);
    const projectsToKeep = projects.filter(p => p.parentId === keepOrganizationId);
    const projectsToRemove = projects.filter(p => p.parentId !== keepOrganizationId);

    if (projectsToKeep.length > 0) {
      const bufferId = await database.bufferChangesIndefinitely();
      try {
        for (const project of projectsToKeep) {
          await services.project.update(project, { parentId: konnectOrganizationId });
        }
      } finally {
        await database.flushChanges(bufferId);
      }
    }

    // `project.remove` buffers and flushes internally, so it must not run inside the buffer above.
    for (const project of projectsToRemove) {
      await services.project.remove(project);
    }

    try {
      const previousLastSyncedAt = localStorage.getItem(lastSyncedAtKey(keepOrganizationId));
      if (previousLastSyncedAt && !localStorage.getItem(lastSyncedAtKey(konnectOrganizationId))) {
        localStorage.setItem(lastSyncedAtKey(konnectOrganizationId), previousLastSyncedAt);
      }
      // `projects` was captured before the re-parent, so it still carries the source organization
      // ids. Orphans are absent from it and keep their key, matching how their data is left alone.
      for (const sourceOrganizationId of new Set([keepOrganizationId, ...projects.map(p => p.parentId)])) {
        localStorage.removeItem(lastSyncedAtKey(sourceOrganizationId));
      }
    } catch {
      // A stale timestamp is cosmetic; never fail the migration over it.
    }
  } finally {
    await projectLock.unlock();
  }
}
