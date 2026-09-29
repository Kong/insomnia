import type { Workspace } from 'insomnia-data';
import { services } from 'insomnia-data';

import { fetchImportContentFromURI, importResourcesToProject, scanResources } from '../../common/import';
import { getInsomniaV5DataExport } from '../../common/insomnia-v5';
import { exportWorkspacesHAR } from '../../main/har';

interface InsomniaExport {
  workspace?: Workspace;
  includePrivate?: boolean;
}

type HarExport = Omit<InsomniaExport, 'format'>;

const getWorkspaces = (activeProjectId?: string) => {
  if (activeProjectId) {
    return services.workspace.listByParentId(activeProjectId);
  }
  // This code path was kept in case there was ever a time when the app wouldn't have an active project.
  // In over 5 months of monitoring in production, we never saw this happen.
  // Keeping it for defensive purposes, but it's not clear if it's necessary.
  return services.workspace.list();
};

/**
 * Plugins receive the YAML directly and have no way to tell the user that entities were
 * skipped, so an incomplete export fails loudly instead of silently dropping data.
 */
const exportWorkspaceYaml = async (workspaceId: string) => {
  const { yaml, errors } = await getInsomniaV5DataExport({ workspaceId, includePrivateEnvironments: false });

  if (errors.length > 0) {
    throw new Error(
      `Could not export workspace ${workspaceId}: ${errors.length} ${errors.length === 1 ? 'entity' : 'entities'} failed schema validation (${errors
        .map(error => `${error.name} (${error.entityType})`)
        .join(', ')})`,
    );
  }

  return yaml;
};

// Only in the case of running unit tests from Inso can activeProjectId be undefined. This is because the concept of a project doesn't exist in git/insomnia sync or an export file
export const init = (activeProjectId?: string) => ({
  data: {
    import: {
      uri: async (uri: string) => {
        if (!activeProjectId) {
          return;
        }

        const content = await fetchImportContentFromURI({
          uri,
        });

        await scanResources([
          {
            contentStr: content,
          },
        ]);

        await importResourcesToProject({
          projectId: activeProjectId,
        });
      },
      raw: async (content: string) => {
        if (!activeProjectId) {
          return;
        }
        await scanResources([
          {
            contentStr: content,
          },
        ]);

        await importResourcesToProject({
          projectId: activeProjectId,
        });
      },
    },
    export: {
      insomnia: async ({ workspace }: { workspace: Workspace }) => {
        if (workspace) {
          const insomniaExport = await exportWorkspaceYaml(workspace._id);

          return [insomniaExport];
        }

        const workspaces = await getWorkspaces(activeProjectId);

        const allInsomniaExports = [];

        for (const workspace of workspaces) {
          const insomniaExport = await exportWorkspaceYaml(workspace._id);
          allInsomniaExports.push(insomniaExport);
        }

        return allInsomniaExports;
      },

      har: async ({ workspace, includePrivate }: HarExport = {}) =>
        exportWorkspacesHAR(workspace ? [workspace] : await getWorkspaces(activeProjectId), Boolean(includePrivate)),
    },
  },
});
