import path from 'node:path';

import { deterministicStringify, generateId } from 'insomnia-data/common';

import { runGraphQL } from './session';
import { getStore } from './store/current-store';
import type { BackendProject, BackendProjectWithTeams, BackendProjectWithTeamsAndTeamProjectId, Branch } from './types';

// These helpers never read a VCS instance's active `_backendProject` — they operate on an
// explicit `rootDocumentId`/`projectId`/`project`, or scan every local project. Keeping them
// outside the `VCS` class means they can be called (and the shared store touched) without ever
// activating a workspace-scoped VCS instance.

export async function getBackendProjectById(projectId: string): Promise<BackendProject | null> {
  return getStore().getItem(`/projects/${projectId}/meta.json`);
}

export async function storeBackendProject(project: BackendProject) {
  let existingProject: BackendProject | null = null;
  try {
    existingProject = await getBackendProjectById(project.id);
  } catch (err) {
    console.warn('[sync] Failed to get existing backend project %s', project.id, err);
  }

  if (existingProject && deterministicStringify(existingProject) === deterministicStringify(project)) {
    console.debug('[sync] Skipping store due to no backend changes');
    return;
  }

  return getStore().setItem(`/projects/${project.id}/meta.json`, project);
}

export async function removeProject(project: BackendProject) {
  console.log(`[sync] Remove local project ${project.id}`);
  return getStore().removeItem(`/projects/${project.id}/meta.json`);
}

export async function localBackendProjects(): Promise<BackendProject[]> {
  const backendProjects: BackendProject[] = [];
  const keys = await getStore().keys('/projects/', false);

  for (const key of keys) {
    const id = path.basename(key);
    const p = await getBackendProjectById(id);

    if (p === null) {
      // Folder exists but project meta file is gone
      continue;
    }

    backendProjects.push(p);
  }

  return backendProjects;
}

export async function getBranches(backendProjectId: string): Promise<Branch[]> {
  const branches: Branch[] = [];

  for (const p of await getStore().keys(`/projects/${backendProjectId}/branches/`)) {
    const b = await getStore().getItem(p);

    if (b === null) {
      // Should never happen
      throw new Error(`Failed to get branch path=${p}`);
    }

    branches.push(b);
  }

  return branches;
}

export async function getBackendProjectByRootDocument(rootDocumentId: string): Promise<BackendProject | null> {
  if (!rootDocumentId) {
    throw new Error('No root document ID supplied for backend project');
  }

  // First, try finding the project
  const backendProjects = await localBackendProjects();
  let matchedBackendProjects = backendProjects.filter(p => p.rootDocumentId === rootDocumentId);

  // If there is more than one project for root, try pruning unused ones by branch activity
  if (matchedBackendProjects.length > 1) {
    for (const p of matchedBackendProjects) {
      const branches = await getBranches(p.id);

      if (!branches.find(b => b.snapshots.length > 0)) {
        await removeProject(p);
        matchedBackendProjects = matchedBackendProjects.filter(({ id }) => id !== p.id);
        console.log(`[sync] Remove inactive project for root ${rootDocumentId}`);
      }
    }
  }

  // If there are still too many, error out
  if (matchedBackendProjects.length > 1) {
    console.log('[sync] Multiple backend projects matched for root', {
      backendProjects,
      matchedBackendProjects,
      rootDocumentId,
    });
    throw new Error('More than one backend project matched query');
  }

  return matchedBackendProjects[0] || null;
}

export async function getOrCreateBackendProjectByRootDocument(
  rootDocumentId: string,
  name: string,
): Promise<BackendProject> {
  let project = await getBackendProjectByRootDocument(rootDocumentId);

  // If we still don't have a project, create one
  if (!project) {
    const id = generateId('prj');
    project = {
      id,
      name,
      rootDocumentId,
    };
    await storeBackendProject(project);
    console.log(`[sync] Created backend project ${project.id}`);
  }

  return project;
}

export async function hasBackendProjectForRootDocument(rootDocumentId: string): Promise<boolean> {
  return Boolean(await getBackendProjectByRootDocument(rootDocumentId));
}

export async function removeBackendProjectsForRoot(rootDocumentId: string) {
  const all = await localBackendProjects();
  const toRemove = all.filter(p => p.rootDocumentId === rootDocumentId);

  for (const backendProject of toRemove) {
    await removeProject(backendProject);
  }
}

export async function remoteBackendProjects({ teamId, teamProjectId }: { teamId: string; teamProjectId: string }) {
  console.log(
    `[remoteBackendProjects] Fetching remote workspaces for teamId=${teamId} teamProjectId=${teamProjectId}`,
  );
  const { projects } = await runGraphQL<{ projects: BackendProjectWithTeams[] }>(
    `
      query ($teamId: ID, $teamProjectId: ID) {
        projects(teamId: $teamId, teamProjectId: $teamProjectId) {
          id
          name
          rootDocumentId
          teams {
            id
            name
          }
        }
      }
    `,
    {
      teamId,
      teamProjectId,
    },
    'projects',
  );

  console.log(`[remoteBackendProjects] Fetched ${projects.length} remote workspaces`);

  return projects.map(backend => ({
    id: backend.id,
    name: backend.name,
    rootDocumentId: backend.rootDocumentId,
    // A backend project is guaranteed to exist on exactly one team
    team: backend.teams[0],
  }));
}

export async function remoteBackendProjectsOfTeam({ teamId }: { teamId: string }) {
  console.log(`[remoteBackendProjectsOfTeam] Fetching remote workspaces for teamId=${teamId}`);

  const { projects } = await runGraphQL<{ projects: BackendProjectWithTeamsAndTeamProjectId[] }>(
    `
      query ($teamId: ID, $allProjects: Boolean) {
        projects(teamId: $teamId, allProjects: $allProjects) {
          id
          name
          rootDocumentId
          teamProjectId
          teams {
            id
            name
          }
        }
      }
    `,
    {
      teamId,
      allProjects: true,
    },
    'projects',
  );

  console.log(`[remoteBackendProjectsOfTeam] Fetched ${projects.length} remote workspaces`);

  return projects.map(backend => ({
    id: backend.id,
    name: backend.name,
    rootDocumentId: backend.rootDocumentId,
    teamProjectId: backend.teamProjectId,
    // A backend project is guaranteed to exist on exactly one team
    team: backend.teams[0],
  }));
}
