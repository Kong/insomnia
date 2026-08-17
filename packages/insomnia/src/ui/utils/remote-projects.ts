import { services } from 'insomnia-data';

import { getUnsyncedRemoteWorkspaces, type InsomniaFile } from '~/common/project';

export const getAllRemoteBackendProjectsOfOrg = async ({ organizationId }: { organizationId: string }) => {
  return window.main.sync.remoteBackendProjectsOfTeam({ teamId: organizationId });
};

export async function getAllRemoteFiles({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  try {
    const project = await services.project.getById(projectId);

    const remoteId = project?.remoteId;
    if (!remoteId) {
      return [];
    }

    console.log(
      '[getAllRemoteFiles] start fetching remote backend workspaces for project',
      projectId,
      `remoteId: ${remoteId}`,
    );

    const [localBackendProjects, allFetchedRemoteBackendProjectsForRemoteId] = await Promise.all([
      // Repairs any locally stored rootDocumentId that no longer resolves to a workspace before
      // returning, so installations affected by a past mismatch stop reporting pulled collections
      // as unsynced. Backend project ids are globally unique, so no filtering by project is needed.
      window.main.sync.reconcileLocalBackendProjects(),
      // Remote backend projects are fetched from the backend since they are not stored locally
      window.main.sync.remoteBackendProjects({ teamId: organizationId, teamProjectId: remoteId }),
    ]);
    console.log(
      `[getAllRemoteFiles] found localBackendProjects: ${localBackendProjects.length} and allFetchedRemoteBackendProjectsForRemoteId: ${allFetchedRemoteBackendProjectsForRemoteId.length} for remoteId: ${remoteId}`,
    );

    // A backend project can be identified by two different workspace ids, and they disagree when its
    // rootDocumentId does not match the workspace inside its snapshot. Both have to be checked:
    //
    //  - the rootDocumentId the remote advertises — matching only on this is what made a pulled
    //    collection stay "Unsynced" forever, because the value never resolves to a local workspace;
    //  - the rootDocumentId local metadata recorded, which is the workspace the pull actually
    //    produced, and is looked up by backend project id (globally unique, and the stable identity
    //    of the remote repository).
    //
    // See docs/cloud-sync-rootdocumentid-mismatch.md.
    const localBackendProjectsById = new Map(localBackendProjects.map(p => [p.id, p]));
    const projectWorkspaces = await services.workspace.listByParentId(project._id);
    const projectWorkspaceIds = new Set(projectWorkspaces.map(w => w._id));

    // Get the list of remote backend projects that we need to pull: never pulled here under either
    // identity, or pulled and then deleted locally.
    const backendProjectsToPull = allFetchedRemoteBackendProjectsForRemoteId.filter(p => {
      const localRootDocumentId = localBackendProjectsById.get(p.id)?.rootDocumentId;
      return ![p.rootDocumentId, localRootDocumentId].some(
        rootDocumentId => rootDocumentId && projectWorkspaceIds.has(rootDocumentId),
      );
    });
    console.log(`[getAllRemoteFiles] get ${backendProjectsToPull.length} unsynced files`);

    const files = backendProjectsToPull.map(backendProject => {
      const file: InsomniaFile = {
        id: backendProject.rootDocumentId,
        name: backendProject.name,
        scope: 'unsynced',
        label: 'Unsynced',
        remoteId: backendProject.id,
        created: 0,
        lastModifiedTimestamp: 0,
      };

      return file;
    });

    // Several backend projects can advertise the same rootDocumentId, and the card id is derived
    // from it, so the list has to be deduplicated or the file grid renders duplicate React keys.
    return getUnsyncedRemoteWorkspaces(files, projectWorkspaces);
  } catch (e) {
    console.warn('Failed to load backend projects', e);
  }

  return [];
}
