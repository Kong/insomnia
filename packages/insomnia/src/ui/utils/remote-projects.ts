import type { Project } from 'insomnia-data';
import type { BackendProjectWithTeamsAndTeamProjectId } from 'insomnia-vcs';

import { type InsomniaFile } from '~/common/project';

export const getAllRemoteBackendProjectsOfOrg = async ({ organizationId }: { organizationId: string }) => {
  return window.main.sync.remoteBackendProjectsOfTeam({ teamId: organizationId });
};

/**
 * Groups the organization's remote backend projects into unsynced InsomniaFiles keyed by local
 * projectId. Pure/sync: the remoteId -> projectId mapping is built from the in-memory projects
 * (which already carry `remoteId`), so no database round-trip is needed.
 *
 * Note: this does NOT filter out already-synced files — callers apply
 * `getUnsyncedRemoteWorkspaces(files, workspaces)` against the relevant local workspaces.
 */
export function groupRemoteFilesByProjectId(
  remoteBackendProjects: BackendProjectWithTeamsAndTeamProjectId[],
  projects: Project[],
): Map<string, InsomniaFile[]> {
  const remoteIdToProjectId = new Map<string, string>();
  for (const project of projects) {
    if (project.remoteId) {
      remoteIdToProjectId.set(project.remoteId, project._id);
    }
  }

  const result = new Map<string, InsomniaFile[]>();
  for (const file of remoteBackendProjects) {
    const projectId = remoteIdToProjectId.get(file.teamProjectId);
    if (!projectId) {
      continue;
    }
    const files = result.get(projectId) ?? [];
    // De-dupe by rootDocumentId in case the backend returns the same project twice.
    if (files.some(f => f.id === file.rootDocumentId)) {
      continue;
    }
    files.push({
      id: file.rootDocumentId,
      name: file.name,
      scope: 'unsynced',
      label: 'Unsynced',
      remoteId: file.id,
      created: 0,
      lastModifiedTimestamp: 0,
    });
    result.set(projectId, files);
  }

  return result;
}
