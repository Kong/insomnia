import { app } from 'electron';
import { models, services } from 'insomnia-data';

import { AnalyticsEvent, trackAnalyticsEvent } from '~/main/analytics';
import type { VCS } from '~/main/cloud-sync/core/vcs';
import { createVCS } from '~/main/cloud-sync/create-vcs';
import type { BackendProject } from '~/sync/types';

/**
 * A backend project advertises the workspace it represents through `rootDocumentId`, but the
 * workspace that actually gets written to the database comes from the latest snapshot. Those two
 * can disagree — see docs/cloud-sync-rootdocumentid-mismatch.md.
 *
 * The snapshot wins. It is immutable and content addressed, every client that already pulled the
 * backend project agrees with it, and rewriting it would change the sync key of every document in
 * the collection. `rootDocumentId` is only a pointer into that data, so it is what gets repaired.
 */
export const reconcileBackendProjectRootDocumentId = async ({
  vcs,
  backendProject,
  workspaceId,
}: {
  vcs: VCS;
  backendProject: BackendProject;
  workspaceId: string;
}): Promise<BackendProject> => {
  if (backendProject.rootDocumentId === workspaceId) {
    return backendProject;
  }

  console.warn(
    `[sync] Backend project ${backendProject.id} declares rootDocumentId=${backendProject.rootDocumentId} but its ` +
      `latest snapshot contains workspace ${workspaceId}. Trusting the snapshot and repairing local metadata.`,
  );

  // The user cannot act on this, so it is deliberately not surfaced in the UI. Track it so we can
  // measure how many backend projects are affected and confirm when the source of the mismatch is fixed.
  trackAnalyticsEvent(AnalyticsEvent.vcsAction, {
    type: 'remote',
    action: 'root_document_id_mismatch',
    backendProjectId: backendProject.id,
  });

  const reconciled: BackendProject = { ...backendProject, rootDocumentId: workspaceId };
  await vcs.setBackendProject(reconciled);
  return reconciled;
};

/**
 * Repair local backend project metadata that was written before the pull started reconciling
 * `rootDocumentId`. Without this, an already-affected installation keeps showing the collection as
 * "Unsynced" forever, because the stored pointer names a workspace that will never exist locally.
 *
 * Purely local and idempotent: no network, and no work at all in the common case where every
 * declared root resolves to a workspace.
 */
export const repairLocalBackendProjectRootDocuments = async (): Promise<BackendProject[]> => {
  // An isolated instance: setBackendProject mutates the active project, which must not leak into
  // concurrent sync.invoke calls running against the singleton.
  const vcs = createVCS({ dataPath: process.env['INSOMNIA_DATA_PATH'] || app.getPath('userData') });
  const backendProjects = await vcs.localBackendProjects();

  if (backendProjects.length === 0) {
    return backendProjects;
  }

  // One batched query, so the healthy case costs a single lookup rather than one per project.
  const declaredRoots = backendProjects.map(backendProject => backendProject.rootDocumentId).filter(Boolean);
  const resolvedWorkspaces = await services.workspace.list({ _id: { $in: declaredRoots } });
  const resolvedRoots = new Set(resolvedWorkspaces.map(workspace => workspace._id));

  return Promise.all(
    backendProjects.map(async backendProject => {
      if (resolvedRoots.has(backendProject.rootDocumentId)) {
        return backendProject;
      }

      const state = await vcs.latestSnapshotStateForBackendProject(backendProject.id);
      const workspaceEntries = state.filter(entry => models.workspace.isWorkspaceId(entry.key));

      // No snapshot yet, or an ambiguous one we should not guess about.
      if (workspaceEntries.length !== 1) {
        return backendProject;
      }

      const [workspaceEntry] = workspaceEntries;

      // The workspace is genuinely absent, so the collection really is unpulled. Leave it alone.
      if (!(await services.workspace.getById(workspaceEntry.key))) {
        return backendProject;
      }

      return reconcileBackendProjectRootDocumentId({
        vcs,
        backendProject,
        workspaceId: workspaceEntry.key,
      });
    }),
  );
};
